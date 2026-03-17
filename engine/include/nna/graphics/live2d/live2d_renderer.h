/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#pragma once

#include "live2d_model.h"
#include "live2d_allocator.h"
#include "nna/export.h"
#include <mutex>
#include <string>

namespace nna::graphics {

class NNA_EXPORT Live2DRenderer {
public:
    Live2DRenderer();
    ~Live2DRenderer();

    /// Initialize Cubism Framework (call once before any model loading)
    bool initFramework();

    /// Shutdown Cubism Framework
    void disposeFramework();

    /// Load a model from directory
    bool loadModel(const std::string& modelDir, const std::string& modelFileName);

    /// Unload current model
    void unloadModel();

    /// Update model state (call per frame)
    void update();

    /// Render model into current OpenGL context/FBO
    void draw(int width, int height, float scale = 1.0f, float offsetX = 0.0f, float offsetY = 0.0f);

    /// Touch interaction
    void onTouch(float screenX, float screenY, int viewWidth, int viewHeight);

    /// Motion control
    void startMotion(const char* group, int no, int priority);

    /// Check if a model is loaded
    bool isModelLoaded() const;

private:
    Live2DAllocator m_allocator;
    Live2DModel* m_model = nullptr;
    std::mutex m_modelMutex;
    bool m_frameworkInitialized = false;
};

} // namespace nna::graphics
