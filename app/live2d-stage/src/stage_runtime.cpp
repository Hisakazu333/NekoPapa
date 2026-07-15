#include "stage_runtime.h"

#ifndef GLFW_INCLUDE_NONE
#define GLFW_INCLUDE_NONE
#endif

#if defined(_WIN32)
#include <Windows.h>
#include <GL/gl.h>
#elif defined(__APPLE__)
#include <OpenGL/gl.h>
#else
#include <GL/gl.h>
#endif

#include <GLFW/glfw3.h>
#include <nlohmann/json.hpp>
#include <nna/graphics/live2d/live2d_renderer.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <deque>
#include <iostream>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <utility>
#include <vector>

namespace openneko::stage {
namespace {

using Json = nlohmann::json;

const char* safeGlString(GLenum name)
{
    const auto* value = glGetString(name);
    return value ? reinterpret_cast<const char*>(value) : "";
}

void glfwErrorCallback(int code, const char* description)
{
    std::cerr << "[live2d-stage] GLFW error " << code << ": "
              << (description ? description : "unknown") << '\n';
}

struct CommandQueue {
    std::mutex mutex;
    std::deque<Json> commands;
    std::atomic<bool> active{true};

    void push(Json command)
    {
        std::lock_guard<std::mutex> lock(mutex);
        commands.push_back(std::move(command));
    }

    std::vector<Json> drain()
    {
        std::vector<Json> result;
        std::lock_guard<std::mutex> lock(mutex);
        result.reserve(commands.size());
        while (!commands.empty()) {
            result.push_back(std::move(commands.front()));
            commands.pop_front();
        }
        return result;
    }
};

void startStdinReader(const std::shared_ptr<CommandQueue>& queue)
{
    std::thread([queue]() {
        std::string line;
        while (queue->active.load(std::memory_order_acquire) && std::getline(std::cin, line)) {
            if (line.empty()) {
                continue;
            }

            Json payload = Json::parse(line, nullptr, false);
            if (payload.is_discarded()) {
                payload = {
                    {"_protocol_error", "invalid_json"}
                };
            }
            if (!queue->active.load(std::memory_order_acquire)) {
                break;
            }
            queue->push(std::move(payload));
        }
    }).detach();
}

void writeProtocol(const Json& payload)
{
    std::cout << payload.dump() << '\n' << std::flush;
}

} // namespace

struct StageRuntime::Impl {
    StageOptions options;
    ModelSelection model;
    GLFWwindow* window = nullptr;
    bool glfwInitialized = false;
    std::unique_ptr<nna::graphics::Live2DRenderer> renderer;
    std::shared_ptr<CommandQueue> commandQueue = std::make_shared<CommandQueue>();

    bool cubismInitialized = false;
    bool modelLoaded = false;
    bool transparentFramebuffer = false;
    bool alwaysOnTop = false;
    bool mousePassthrough = false;
    bool shutdownRequested = false;
    bool cursorInside = false;
    int framesRendered = 0;
    unsigned int firstGlError = GL_NO_ERROR;
    double lastCursorX = 0.0;
    double lastCursorY = 0.0;

    std::string glfwVersion;
    std::string glVendor;
    std::string glRenderer;
    std::string glVersion;
    std::string runtimeError;
    std::string modelError;

    explicit Impl(StageOptions stageOptions, ModelSelection modelSelection)
        : options(std::move(stageOptions))
        , model(std::move(modelSelection))
    {
    }

    ~Impl()
    {
        commandQueue->active.store(false, std::memory_order_release);
        if (window) {
            glfwMakeContextCurrent(window);
        }
        renderer.reset();
        if (window) {
            glfwDestroyWindow(window);
            window = nullptr;
        }
        if (glfwInitialized) {
            glfwTerminate();
            glfwInitialized = false;
        }
    }

    static Impl* fromWindow(GLFWwindow* source)
    {
        return static_cast<Impl*>(glfwGetWindowUserPointer(source));
    }

    static void framebufferSizeCallback(GLFWwindow*, int, int)
    {
        // The current framebuffer dimensions are queried immediately before drawing.
    }

    static void keyCallback(GLFWwindow* source, int key, int, int action, int)
    {
        if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS) {
            glfwSetWindowShouldClose(source, GLFW_TRUE);
        }
    }

    static void cursorPositionCallback(GLFWwindow* source, double x, double y)
    {
        Impl* self = fromWindow(source);
        if (!self) {
            return;
        }
        self->lastCursorX = x;
        self->lastCursorY = y;
        self->updateLookTracking(x, y);
    }

    static void cursorEnterCallback(GLFWwindow* source, int entered)
    {
        Impl* self = fromWindow(source);
        if (!self) {
            return;
        }

        self->cursorInside = entered == GLFW_TRUE;
        if (!self->renderer || !self->modelLoaded || self->mousePassthrough) {
            return;
        }
        if (self->cursorInside) {
            float x = 0.0f;
            float y = 0.0f;
            if (self->normalizedCursor(self->lastCursorX, self->lastCursorY, x, y)) {
                self->renderer->startLookTracking(x, y, 1.0f);
            }
        } else {
            self->renderer->releaseLookTracking(900);
        }
    }

    static void mouseButtonCallback(GLFWwindow* source, int button, int action, int)
    {
        Impl* self = fromWindow(source);
        if (!self || button != GLFW_MOUSE_BUTTON_LEFT || action != GLFW_PRESS
            || !self->renderer || !self->modelLoaded || self->mousePassthrough) {
            return;
        }

        int windowWidth = 0;
        int windowHeight = 0;
        int framebufferWidth = 0;
        int framebufferHeight = 0;
        glfwGetWindowSize(source, &windowWidth, &windowHeight);
        glfwGetFramebufferSize(source, &framebufferWidth, &framebufferHeight);
        if (windowWidth <= 0 || windowHeight <= 0 || framebufferWidth <= 0 || framebufferHeight <= 0) {
            return;
        }

        const float framebufferX = static_cast<float>(
            self->lastCursorX * static_cast<double>(framebufferWidth) / windowWidth);
        const float framebufferY = static_cast<float>(
            self->lastCursorY * static_cast<double>(framebufferHeight) / windowHeight);
        self->renderer->onTouch(
            framebufferX,
            framebufferY,
            framebufferWidth,
            framebufferHeight,
            static_cast<float>(framebufferWidth),
            static_cast<float>(framebufferHeight));
    }

    bool normalizedCursor(double cursorX, double cursorY, float& normalizedX, float& normalizedY) const
    {
        if (!window) {
            return false;
        }
        int width = 0;
        int height = 0;
        glfwGetWindowSize(window, &width, &height);
        if (width <= 0 || height <= 0) {
            return false;
        }
        normalizedX = static_cast<float>(cursorX / width * 2.0 - 1.0);
        normalizedY = static_cast<float>(1.0 - cursorY / height * 2.0);
        normalizedX = std::max(-1.0f, std::min(1.0f, normalizedX));
        normalizedY = std::max(-1.0f, std::min(1.0f, normalizedY));
        return true;
    }

    void updateLookTracking(double cursorX, double cursorY)
    {
        if (!cursorInside || !renderer || !modelLoaded || mousePassthrough) {
            return;
        }
        float x = 0.0f;
        float y = 0.0f;
        if (normalizedCursor(cursorX, cursorY, x, y)) {
            renderer->updateLookTracking(x, y, 1.0f);
        }
    }

    bool initializeWindow()
    {
        glfwSetErrorCallback(glfwErrorCallback);
        if (glfwInit() != GLFW_TRUE) {
            runtimeError = "glfw_init_failed";
            return false;
        }
        glfwInitialized = true;
        if (const char* version = glfwGetVersionString()) {
            glfwVersion = version;
        }

        glfwDefaultWindowHints();
        glfwWindowHint(GLFW_VISIBLE, options.hidden ? GLFW_FALSE : GLFW_TRUE);
        glfwWindowHint(GLFW_DECORATED, GLFW_FALSE);
        glfwWindowHint(GLFW_TRANSPARENT_FRAMEBUFFER, GLFW_TRUE);
        glfwWindowHint(GLFW_FLOATING, GLFW_TRUE);
        glfwWindowHint(GLFW_FOCUS_ON_SHOW, GLFW_FALSE);
        glfwWindowHint(GLFW_ALPHA_BITS, 8);
        glfwWindowHint(GLFW_DEPTH_BITS, 24);
        glfwWindowHint(GLFW_STENCIL_BITS, 8);

#if defined(__APPLE__)
        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 2);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 1);
#else
        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
        glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_COMPAT_PROFILE);
#endif

        window = glfwCreateWindow(
            options.width,
            options.height,
            "OpenNeko Live2D Stage",
            nullptr,
            nullptr);
        if (!window) {
            runtimeError = "glfw_window_create_failed";
            return false;
        }

        glfwSetWindowUserPointer(window, this);
        glfwSetFramebufferSizeCallback(window, framebufferSizeCallback);
        glfwSetKeyCallback(window, keyCallback);
        glfwSetCursorPosCallback(window, cursorPositionCallback);
        glfwSetCursorEnterCallback(window, cursorEnterCallback);
        glfwSetMouseButtonCallback(window, mouseButtonCallback);

        glfwMakeContextCurrent(window);
        glfwSwapInterval(1);

        glVendor = safeGlString(GL_VENDOR);
        glRenderer = safeGlString(GL_RENDERER);
        glVersion = safeGlString(GL_VERSION);
        transparentFramebuffer = glfwGetWindowAttrib(window, GLFW_TRANSPARENT_FRAMEBUFFER) == GLFW_TRUE;
        alwaysOnTop = glfwGetWindowAttrib(window, GLFW_FLOATING) == GLFW_TRUE;
        applyPassthrough(options.passthrough);

        glEnable(GL_BLEND);
        glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
        glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
        clearGlErrors();
        return true;
    }

    void initializeRenderer()
    {
        renderer = std::make_unique<nna::graphics::Live2DRenderer>();
        cubismInitialized = renderer->initFramework();
        // GLEW may leave GL_INVALID_ENUM behind while probing extensions.
        clearGlErrors();
        if (!cubismInitialized) {
            runtimeError = "cubism_init_failed";
            std::cerr << "[live2d-stage] Cubism initialization failed\n";
            return;
        }

        if (!model.found()) {
            modelError = model.error.empty() ? "model_not_found" : model.error;
            std::cerr << "[live2d-stage] degraded: " << modelError << '\n';
            return;
        }

        std::string directory = model.directory.u8string();
        if (!directory.empty() && directory.back() != '/' && directory.back() != '\\') {
            directory.push_back('/');
        }
        modelLoaded = renderer->loadModel(directory, model.fileName);
        drainGlErrors();
        if (!modelLoaded) {
            modelError = "model_load_failed: " + model.fullPath().u8string();
            std::cerr << "[live2d-stage] degraded: " << modelError << '\n';
        } else {
            std::cerr << "[live2d-stage] model loaded: " << model.fullPath().u8string() << '\n';
        }
    }

    void applyPassthrough(bool enabled)
    {
        if (!window) {
            mousePassthrough = false;
            return;
        }
        glfwSetWindowAttrib(window, GLFW_MOUSE_PASSTHROUGH, enabled ? GLFW_TRUE : GLFW_FALSE);
        mousePassthrough = glfwGetWindowAttrib(window, GLFW_MOUSE_PASSTHROUGH) == GLFW_TRUE;
        if (mousePassthrough && renderer && cursorInside) {
            renderer->releaseLookTracking(300);
            cursorInside = false;
        }
    }

    void drainGlErrors()
    {
        GLenum error = GL_NO_ERROR;
        while ((error = glGetError()) != GL_NO_ERROR) {
            if (firstGlError == GL_NO_ERROR) {
                firstGlError = static_cast<unsigned int>(error);
            }
            std::cerr << "[live2d-stage] OpenGL error: " << static_cast<unsigned int>(error) << '\n';
        }
    }

    void clearGlErrors()
    {
        while (glGetError() != GL_NO_ERROR) {
        }
    }

    void drawFallback(int width, int height)
    {
        const int panelWidth = std::max(80, std::min(width * 3 / 5, 360));
        const int panelHeight = std::max(36, std::min(height / 8, 96));
        const int panelX = (width - panelWidth) / 2;
        const int panelY = (height - panelHeight) / 2;

        glEnable(GL_SCISSOR_TEST);
        glScissor(panelX, panelY, panelWidth, panelHeight);
        glClearColor(0.035f, 0.043f, 0.055f, 0.42f);
        glClear(GL_COLOR_BUFFER_BIT);

        const int accentWidth = std::max(4, panelWidth / 48);
        glScissor(panelX, panelY, accentWidth, panelHeight);
        glClearColor(0.03f, 0.22f, 0.32f, 0.72f);
        glClear(GL_COLOR_BUFFER_BIT);
        glDisable(GL_SCISSOR_TEST);
        glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
    }

    bool renderFrame()
    {
        if (!window) {
            return false;
        }

        glfwMakeContextCurrent(window);
        int width = 0;
        int height = 0;
        glfwGetFramebufferSize(window, &width, &height);
        if (width <= 0 || height <= 0) {
            return false;
        }

        glViewport(0, 0, width, height);
        glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);

        if (renderer && cubismInitialized) {
            renderer->update();
            if (modelLoaded) {
                renderer->draw(
                    width,
                    height,
                    1.0f,
                    0.0f,
                    0.0f,
                    static_cast<float>(width),
                    static_cast<float>(height));
            } else {
                drawFallback(width, height);
            }
        } else {
            drawFallback(width, height);
        }

        glfwSwapBuffers(window);
        ++framesRendered;
        drainGlErrors();
        return true;
    }

    std::string status() const
    {
        if (!runtimeError.empty() || !window || !cubismInitialized || firstGlError != GL_NO_ERROR) {
            return "failed";
        }
        if (!modelLoaded) {
            if (options.healthCheck && !options.allowNoModel) {
                return "failed";
            }
            return "degraded";
        }
        if (!transparentFramebuffer || !alwaysOnTop
            || (options.passthrough && !mousePassthrough)) {
            return "degraded";
        }
        return "ready";
    }

    std::string errorMessage() const
    {
        if (!runtimeError.empty()) {
            return runtimeError;
        }
        if (firstGlError != GL_NO_ERROR) {
            return "opengl_error: " + std::to_string(firstGlError);
        }
        if (!modelLoaded) {
            return modelError.empty() ? "model_not_loaded" : modelError;
        }
        if (!transparentFramebuffer) {
            return "transparent_framebuffer_unavailable";
        }
        if (!alwaysOnTop) {
            return "always_on_top_unavailable";
        }
        if (options.passthrough && !mousePassthrough) {
            return "mouse_passthrough_unavailable";
        }
        return {};
    }

    Json statePayload(const char* event) const
    {
        Json payload = {
            {"event", event},
            {"status", status()},
            {"glfw_version", glfwVersion},
            {"gl_vendor", glVendor},
            {"gl_renderer", glRenderer},
            {"gl_version", glVersion},
            {"transparent_framebuffer", transparentFramebuffer},
            {"always_on_top", alwaysOnTop},
            {"mouse_passthrough", mousePassthrough},
            {"cubism_initialized", cubismInitialized},
            {"model_loaded", modelLoaded},
            {"frames_rendered", framesRendered},
            {"gl_error", firstGlError},
            {"hidden", window ? glfwGetWindowAttrib(window, GLFW_VISIBLE) != GLFW_TRUE : true}
        };
        if (options.healthCheck) {
            payload["frames_requested"] = options.frames;
            payload["allow_no_model"] = options.allowNoModel;
        }
        if (model.found()) {
            payload["model_path"] = model.fullPath().u8string();
        } else {
            payload["model_path"] = nullptr;
        }
        const std::string error = errorMessage();
        if (!error.empty()) {
            payload["error"] = error;
        }
        return payload;
    }

    void processCommands()
    {
        for (const Json& commandPayload : commandQueue->drain()) {
            Json response = {
                {"event", "command_result"},
                {"ok", false}
            };

            if (commandPayload.is_object() && commandPayload.contains("id")) {
                response["id"] = commandPayload["id"];
            }
            if (!commandPayload.is_object()) {
                response["error"] = "command must be a JSON object";
                writeProtocol(response);
                continue;
            }
            if (commandPayload.contains("_protocol_error")) {
                response["error"] = commandPayload["_protocol_error"];
                writeProtocol(response);
                continue;
            }

            std::string command;
            if (commandPayload.contains("command") && commandPayload["command"].is_string()) {
                command = commandPayload["command"].get<std::string>();
            } else if (commandPayload.contains("cmd") && commandPayload["cmd"].is_string()) {
                command = commandPayload["cmd"].get<std::string>();
            }
            response["command"] = command;

            if (command == "show") {
                glfwShowWindow(window);
                response["ok"] = true;
                response["visible"] = true;
            } else if (command == "hide") {
                glfwHideWindow(window);
                response["ok"] = true;
                response["visible"] = false;
            } else if (command == "shutdown") {
                shutdownRequested = true;
                glfwSetWindowShouldClose(window, GLFW_TRUE);
                response["ok"] = true;
            } else if (command == "set_passthrough") {
                const Json* enabled = nullptr;
                for (const char* key : {"enabled", "value", "passthrough"}) {
                    if (commandPayload.contains(key) && commandPayload[key].is_boolean()) {
                        enabled = &commandPayload[key];
                        break;
                    }
                }
                if (!enabled) {
                    response["error"] = "set_passthrough requires a boolean enabled value";
                } else {
                    const bool requested = enabled->get<bool>();
                    applyPassthrough(requested);
                    response["ok"] = mousePassthrough == requested;
                    response["mouse_passthrough"] = mousePassthrough;
                    if (mousePassthrough != requested) {
                        response["error"] = "mouse passthrough is not supported by this window system";
                    }
                }
            } else {
                response["error"] = "unsupported command";
            }
            writeProtocol(response);
        }
    }

    int runHealthCheck()
    {
        for (int frame = 0; frame < options.frames; ++frame) {
            glfwPollEvents();
            renderFrame();
        }
        glFinish();
        drainGlErrors();
        writeProtocol(statePayload("health"));

        if (status() == "ready" || status() == "degraded") {
            return 0;
        }
        if (!runtimeError.empty() || !cubismInitialized || firstGlError != GL_NO_ERROR) {
            return 3;
        }
        return !modelLoaded && !options.allowNoModel ? 4 : 3;
    }

    int runInteractive()
    {
        writeProtocol(statePayload("ready"));
        startStdinReader(commandQueue);

        using Clock = std::chrono::steady_clock;
        constexpr auto frameInterval = std::chrono::milliseconds(33);
        auto nextFrame = Clock::now();

        while (glfwWindowShouldClose(window) != GLFW_TRUE) {
            processCommands();
            if (glfwWindowShouldClose(window) == GLFW_TRUE) {
                break;
            }

            const bool visible = glfwGetWindowAttrib(window, GLFW_VISIBLE) == GLFW_TRUE;
            const bool iconified = glfwGetWindowAttrib(window, GLFW_ICONIFIED) == GLFW_TRUE;
            if (!visible || iconified) {
                glfwWaitEventsTimeout(0.05);
                nextFrame = Clock::now();
                continue;
            }

            const auto now = Clock::now();
            if (now < nextFrame) {
                const double timeout = std::min(
                    0.01,
                    std::chrono::duration<double>(nextFrame - now).count());
                glfwWaitEventsTimeout(timeout);
                continue;
            }

            glfwPollEvents();
            renderFrame();
            nextFrame = Clock::now() + frameInterval;
        }

        commandQueue->active.store(false, std::memory_order_release);
        writeProtocol({
            {"event", "stopped"},
            {"reason", shutdownRequested ? "shutdown" : "window_closed"},
            {"frames_rendered", framesRendered}
        });
        return 0;
    }

    int run()
    {
        if (!initializeWindow()) {
            if (options.healthCheck) {
                writeProtocol(statePayload("health"));
            } else {
                writeProtocol(statePayload("ready"));
            }
            return 3;
        }

        initializeRenderer();
        if (options.healthCheck) {
            return runHealthCheck();
        }
        return runInteractive();
    }
};

StageRuntime::StageRuntime(StageOptions options, ModelSelection model)
    : impl_(std::make_unique<Impl>(std::move(options), std::move(model)))
{
}

StageRuntime::~StageRuntime() = default;

int StageRuntime::run()
{
    return impl_->run();
}

} // namespace openneko::stage
