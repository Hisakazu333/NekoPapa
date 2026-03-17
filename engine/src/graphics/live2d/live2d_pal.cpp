/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#include "nna/graphics/live2d/live2d_pal.h"
#include <cstdarg>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <chrono>

#ifdef _WIN32
#include <Windows.h>
#endif

namespace nna::graphics {

static double s_currentFrame = 0.0;
static double s_lastFrame = 0.0;
static double s_deltaTime = 0.0;
static std::string s_modelRootPath;

void Live2DPal::printLog(const char* format, ...) {
    va_list args;
    char buf[512];
    va_start(args, format);
    vsnprintf(buf, sizeof(buf), format, args);
    va_end(args);
    std::fprintf(stderr, "[NNA::Live2D] %s\n", buf);
}

void Live2DPal::printMessage(const char* message) {
    printLog("%s", message);
}

void Live2DPal::updateTime() {
    auto now = std::chrono::high_resolution_clock::now();
    auto epoch = now.time_since_epoch();
    s_currentFrame = std::chrono::duration<double>(epoch).count();

    if (s_lastFrame == 0.0) {
        s_lastFrame = s_currentFrame;
    }

    s_deltaTime = s_currentFrame - s_lastFrame;
    if (s_deltaTime > 0.05) {
        s_deltaTime = 0.05;
    }
    s_lastFrame = s_currentFrame;
}

double Live2DPal::getDeltaTime() {
    return s_deltaTime;
}

void Live2DPal::setModelRootPath(const std::string& path) {
    s_modelRootPath = path;
}

std::string Live2DPal::getModelRootPath() {
    return s_modelRootPath;
}

Csm::csmByte* Live2DPal::loadFileAsBytes(const std::string& filePath, Csm::csmSizeInt* outSize) {
    // Normalize path
    std::string fullPath;
    if (!s_modelRootPath.empty() && filePath.find(s_modelRootPath) == std::string::npos) {
        fullPath = s_modelRootPath + "/" + filePath;
    } else {
        fullPath = filePath;
    }

    // Remove double slashes
    size_t pos = 0;
    while ((pos = fullPath.find("//", pos)) != std::string::npos) {
        fullPath.replace(pos, 2, "/");
        pos += 1;
    }

    std::ifstream file;
#ifdef _WIN32
    // Windows: convert UTF-8 path to wide string for non-ASCII file names
    int wlen = MultiByteToWideChar(CP_UTF8, 0, fullPath.c_str(), -1, nullptr, 0);
    if (wlen > 0) {
        std::wstring wpath(wlen - 1, L'\0');
        MultiByteToWideChar(CP_UTF8, 0, fullPath.c_str(), -1, &wpath[0], wlen);
        file.open(wpath, std::ios::binary | std::ios::ate);
    }
#else
    file.open(fullPath, std::ios::binary | std::ios::ate);
#endif
    if (!file.is_open()) {
        printLog("ERROR: Failed to open file: %s", fullPath.c_str());
        if (outSize) *outSize = 0;
        return nullptr;
    }

    auto size = file.tellg();
    if (size <= 0) {
        printLog("ERROR: File is empty: %s", fullPath.c_str());
        if (outSize) *outSize = 0;
        return nullptr;
    }

    file.seekg(0, std::ios::beg);
    auto* data = static_cast<Csm::csmByte*>(std::malloc(static_cast<size_t>(size)));
    file.read(reinterpret_cast<char*>(data), size);
    file.close();

    if (outSize) *outSize = static_cast<Csm::csmSizeInt>(size);
    printLog("Loaded file: %s (%lld bytes)", fullPath.c_str(), static_cast<long long>(size));
    return data;
}

void Live2DPal::releaseBytes(Csm::csmByte* byteData) {
    if (byteData) {
        std::free(byteData);
    }
}

} // namespace nna::graphics
