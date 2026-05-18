/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#include "nna_avatar_canvas.h"
#include <QDateTime>
#include <QHoverEvent>
#include <QMouseEvent>
#include <QOpenGLFramebufferObject>
#include <QOpenGLContext>
#include <QOpenGLFunctions>
#include <QQuickWindow>
#include <QDir>

#ifdef NNA_ENABLE_LIVE2D
#include "nna/graphics/live2d/live2d_pal.h"
#endif

namespace {

float clampUnitSigned(float value) {
    if (value < -1.0f) {
        return -1.0f;
    }
    if (value > 1.0f) {
        return 1.0f;
    }
    return value;
}

float normalizePointerX(float x, float width) {
    if (width <= 0.0f) {
        return 0.0f;
    }
    return clampUnitSigned((x / width) * 2.0f - 1.0f);
}

float normalizePointerY(float y, float height) {
    if (height <= 0.0f) {
        return 0.0f;
    }
    return clampUnitSigned(-((y / height) * 2.0f - 1.0f));
}

} // namespace

// Minimal no-op renderer used when Live2D is disabled — prevents null-deref in Qt
class NNAFallbackRenderer : public QQuickFramebufferObject::Renderer {
public:
    QOpenGLFramebufferObject* createFramebufferObject(const QSize& size) override {
        return new QOpenGLFramebufferObject(size, QOpenGLFramebufferObject::CombinedDepthStencil);
    }
    void render() override {
        auto* f = QOpenGLContext::currentContext()->functions();
        f->glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
        f->glClear(GL_COLOR_BUFFER_BIT);
    }
};

#ifdef NNA_ENABLE_LIVE2D

class NNAAvatarCanvasRenderer : public QQuickFramebufferObject::Renderer {
public:
    explicit NNAAvatarCanvasRenderer(NNAAvatarCanvas* item)
        : m_item(item) {}

    QOpenGLFramebufferObject* createFramebufferObject(const QSize& size) override {
        QOpenGLFramebufferObject::Attachment attachment =
            QOpenGLFramebufferObject::CombinedDepthStencil;
        return new QOpenGLFramebufferObject(size, attachment);
    }

    void synchronize(QQuickFramebufferObject* item) override {
        auto* canvas = static_cast<NNAAvatarCanvas*>(item);
        m_width = static_cast<int>(canvas->width());
        m_height = static_cast<int>(canvas->height());
        m_scale = canvas->m_modelScale;
        m_offsetX = canvas->m_modelOffsetX;
        m_offsetY = canvas->m_modelOffsetY;
        m_projectionWidthHint = canvas->m_projectionWidthHint;
        m_projectionHeightHint = canvas->m_projectionHeightHint;

        if (canvas->m_modelPath != m_currentModelPath) {
            m_currentModelPath = canvas->m_modelPath;
            m_needsReload = true;
        }
    }

    void render() override {
        if (!m_item->m_live2dRenderer || m_initFailed) return;

        // Initialize Cubism Framework on first render (needs OpenGL context)
        if (!m_frameworkReady) {
            if (!m_item->m_live2dRenderer->initFramework()) {
                qWarning() << "[NNAAvatarCanvas] render: framework init FAILED, disabling Live2D";
                m_initFailed = true;
                return;
            }
            m_frameworkReady = true;
        }

        // Re-check model path (QML binding may resolve after first synchronize)
        if (m_item->m_modelPath != m_currentModelPath) {
            m_currentModelPath = m_item->m_modelPath;
            m_needsReload = true;
        }

        if (m_needsReload && !m_currentModelPath.isEmpty()) {
            m_needsReload = false;
            loadModel();
        } else if (m_needsReload && m_currentModelPath.isEmpty()) {
            m_needsReload = false;
            m_item->m_live2dRenderer->unloadModel();
            m_item->m_modelLoaded = false;
            m_item->m_modelLoadFailed = false;
            emit m_item->modelLoadedChanged();
        }

        m_item->m_live2dRenderer->update();

        // Use FBO actual size, not logical item size
        auto* fbo = framebufferObject();
        int fboW = fbo ? fbo->width() : m_width;
        int fboH = fbo ? fbo->height() : m_height;

        glViewport(0, 0, fboW, fboH);
        glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        if (m_item->m_live2dRenderer->isModelLoaded()) {
            m_item->m_live2dRenderer->draw(
                fboW,
                fboH,
                m_scale,
                m_offsetX,
                m_offsetY,
                m_projectionWidthHint,
                m_projectionHeightHint
            );
        }
    }

private:
    void loadModel() {
        QDir modelDir(m_currentModelPath);
        if (!modelDir.exists()) {
            emit m_item->modelError("Model directory not found: " + m_currentModelPath);
            return;
        }

        QStringList jsonFiles = modelDir.entryList({"*.model3.json"}, QDir::Files);
        if (jsonFiles.isEmpty()) {
            emit m_item->modelError("No .model3.json found in: " + m_currentModelPath);
            return;
        }

        QString dirPath = m_currentModelPath;
        if (!dirPath.endsWith('/')) dirPath += '/';

        nna::graphics::Live2DPal::setModelRootPath("");

        bool ok = m_item->m_live2dRenderer->loadModel(
            dirPath.toStdString(), jsonFiles.first().toStdString());

        m_item->m_modelLoaded = ok;
        m_item->m_modelLoadFailed = !ok;
        emit m_item->modelLoadedChanged();

        if (!ok) {
            emit m_item->modelError("Failed to load model: " + jsonFiles.first());
        }
    }

    NNAAvatarCanvas* m_item;
    int m_width = 0;
    int m_height = 0;
    float m_scale = 1.0f;
    float m_offsetX = 0.0f;
    float m_offsetY = 0.0f;
    float m_projectionWidthHint = 0.0f;
    float m_projectionHeightHint = 0.0f;
    QString m_currentModelPath;
    bool m_needsReload = false;
    bool m_frameworkReady = false;
    bool m_initFailed = false;
};

#endif // NNA_ENABLE_LIVE2D

// --- NNAAvatarCanvas implementation ---

NNAAvatarCanvas::NNAAvatarCanvas(QQuickItem* parent)
    : QQuickFramebufferObject(parent)
{
    setAcceptedMouseButtons(Qt::LeftButton);
    setAcceptHoverEvents(true);
    setMirrorVertically(true);
    m_frameTimer.setTimerType(Qt::CoarseTimer);
    m_frameTimer.setSingleShot(false);

    connect(&m_frameTimer, &QTimer::timeout, this, [this]() {
        update();
    });
    connect(this, &QQuickItem::visibleChanged, this, &NNAAvatarCanvas::refreshFrameLoop);
    connect(this, &QQuickItem::windowChanged, this, [this](QQuickWindow* window) {
        bindWindow(window);
        refreshFrameLoop();
    });
    connect(this, &NNAAvatarCanvas::modelPathChanged, this, &NNAAvatarCanvas::refreshFrameLoop);
    connect(this, &NNAAvatarCanvas::modelLoadedChanged, this, &NNAAvatarCanvas::refreshFrameLoop);
    connect(this, &NNAAvatarCanvas::modelError, this, [this](const QString&) {
        m_modelLoadFailed = true;
        refreshFrameLoop();
    });

#ifdef NNA_ENABLE_LIVE2D
    m_live2dRenderer = new nna::graphics::Live2DRenderer();
#endif
}

NNAAvatarCanvas::~NNAAvatarCanvas() {
#ifdef NNA_ENABLE_LIVE2D
    delete m_live2dRenderer;
#endif
}

void NNAAvatarCanvas::componentComplete()
{
    QQuickFramebufferObject::componentComplete();
    bindWindow(window());
    refreshFrameLoop();
}

void NNAAvatarCanvas::refreshFrameLoop()
{
    const QQuickWindow* currentWindow = m_boundWindow ? m_boundWindow.data() : window();
    const bool hasModelSource = !m_modelPath.isEmpty() && (!m_modelLoadFailed || m_modelLoaded);
    const bool canRun = isVisible() && currentWindow && currentWindow->isVisible() && currentWindow->isExposed() && hasModelSource;

    if (!canRun) {
        if (m_frameTimer.isActive())
            m_frameTimer.stop();
        return;
    }

    const bool active = currentWindow->isActive();
    const int intervalMs = active ? 33 : 100;
    if (!m_frameTimer.isActive() || m_frameTimer.interval() != intervalMs)
        m_frameTimer.start(intervalMs);
}

void NNAAvatarCanvas::bindWindow(QQuickWindow* window)
{
    if (m_boundWindow == window)
        return;

    if (m_boundWindow)
        QObject::disconnect(m_boundWindow.data(), nullptr, this, nullptr);

    m_boundWindow = window;

    if (!m_boundWindow)
        return;

    connect(m_boundWindow.data(), &QQuickWindow::activeChanged, this, &NNAAvatarCanvas::refreshFrameLoop);
    connect(m_boundWindow.data(), &QWindow::visibilityChanged, this, &NNAAvatarCanvas::refreshFrameLoop);
    connect(m_boundWindow.data(), &QObject::destroyed, this, [this]() {
        m_boundWindow = nullptr;
        refreshFrameLoop();
    });
}

QQuickFramebufferObject::Renderer* NNAAvatarCanvas::createRenderer() const {
#ifdef NNA_ENABLE_LIVE2D
    auto* r = new NNAAvatarCanvasRenderer(const_cast<NNAAvatarCanvas*>(this));
    return r;
#else
    return new NNAFallbackRenderer();
#endif
}

QString NNAAvatarCanvas::modelPath() const { return m_modelPath; }

void NNAAvatarCanvas::setModelPath(const QString& path) {
    if (m_modelPath != path) {
        m_modelPath = path;
        m_modelLoadFailed = false;
        emit modelPathChanged();
        update();
        refreshFrameLoop();
    }
}

bool NNAAvatarCanvas::modelLoaded() const { return m_modelLoaded; }

void NNAAvatarCanvas::startMotion(const QString& group, int no, int priority) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->startMotion(group.toUtf8().constData(), no, priority);
    }
#endif
}

void NNAAvatarCanvas::setMouthOpen(float value) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->setMouthOpen(value);
        update();
    }
#else
    Q_UNUSED(value);
#endif
}

void NNAAvatarCanvas::setExpression(const QString& expressionId) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->setExpression(expressionId.toUtf8().constData());
        update();
    }
#else
    Q_UNUSED(expressionId);
#endif
}

void NNAAvatarCanvas::setParameterValue(const QString& parameterId, float value, float weight) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->setParameterValue(parameterId.toUtf8().constData(), value, weight);
        update();
    }
#else
    Q_UNUSED(parameterId);
    Q_UNUSED(value);
    Q_UNUSED(weight);
#endif
}

void NNAAvatarCanvas::addParameterValue(const QString& parameterId, float value, float weight) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->addParameterValue(parameterId.toUtf8().constData(), value, weight);
        update();
    }
#else
    Q_UNUSED(parameterId);
    Q_UNUSED(value);
    Q_UNUSED(weight);
#endif
}

void NNAAvatarCanvas::clearParameterValue(const QString& parameterId) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->clearParameterValue(parameterId.toUtf8().constData());
        update();
    }
#else
    Q_UNUSED(parameterId);
#endif
}

QString NNAAvatarCanvas::modelCapabilityJson() const {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        return QString::fromStdString(m_live2dRenderer->capabilityJson());
    }
#endif
    return QStringLiteral("{\"loaded\":false}");
}

void NNAAvatarCanvas::triggerLookAt(float x, float y, float strength, int durationMs) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->triggerLookAt(x, y, strength, durationMs);
        update();
    }
#else
    Q_UNUSED(x);
    Q_UNUSED(y);
    Q_UNUSED(strength);
    Q_UNUSED(durationMs);
#endif
}

void NNAAvatarCanvas::startLookTracking(float x, float y, float strength) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->startLookTracking(x, y, strength);
        update();
    }
#else
    Q_UNUSED(x);
    Q_UNUSED(y);
    Q_UNUSED(strength);
#endif
}

void NNAAvatarCanvas::updateLookTracking(float x, float y, float strength) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->updateLookTracking(x, y, strength);
        update();
    }
#else
    Q_UNUSED(x);
    Q_UNUSED(y);
    Q_UNUSED(strength);
#endif
}

void NNAAvatarCanvas::releaseLookTracking(int durationMs) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->releaseLookTracking(durationMs);
        update();
    }
#else
    Q_UNUSED(durationMs);
#endif
}

void NNAAvatarCanvas::onTouchAt(float x, float y) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->onTouch(x, y,
            static_cast<int>(width()),
            static_cast<int>(height()),
            m_projectionWidthHint,
            m_projectionHeightHint);
    }
#endif
}

void NNAAvatarCanvas::mousePressEvent(QMouseEvent* event) {
    onTouchAt(static_cast<float>(event->position().x()),
              static_cast<float>(event->position().y()));
    event->accept();
}

void NNAAvatarCanvas::hoverEnterEvent(QHoverEvent* event) {
    m_lastHoverUpdateMs = QDateTime::currentMSecsSinceEpoch();
    const float x = normalizePointerX(static_cast<float>(event->position().x()), static_cast<float>(width()));
    const float y = normalizePointerY(static_cast<float>(event->position().y()), static_cast<float>(height()));
    startLookTracking(x, y, 1.0f);
    event->accept();
}

void NNAAvatarCanvas::hoverMoveEvent(QHoverEvent* event) {
    const qint64 now = QDateTime::currentMSecsSinceEpoch();
    if (now - m_lastHoverUpdateMs < 16) {
        event->accept();
        return;
    }
    m_lastHoverUpdateMs = now;
    const float x = normalizePointerX(static_cast<float>(event->position().x()), static_cast<float>(width()));
    const float y = normalizePointerY(static_cast<float>(event->position().y()), static_cast<float>(height()));
    updateLookTracking(x, y, 1.0f);
    event->accept();
}

void NNAAvatarCanvas::hoverLeaveEvent(QHoverEvent* event) {
    m_lastHoverUpdateMs = 0;
    releaseLookTracking(900);
    event->accept();
}
