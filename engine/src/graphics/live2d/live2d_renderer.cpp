/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#include "nna/graphics/live2d/live2d_renderer.h"
#include "nna/graphics/live2d/live2d_pal.h"
#include <CubismFramework.hpp>

namespace nna::graphics {

static Csm::csmByte* s_loadFile(const std::string fileName, Csm::csmSizeInt* outSize) {
    return Live2DPal::loadFileAsBytes(fileName, outSize);
}

static void s_releaseBytes(Csm::csmByte* address) {
    Live2DPal::releaseBytes(address);
}

Live2DRenderer::Live2DRenderer() {}

Live2DRenderer::~Live2DRenderer() {
    unloadModel();
    disposeFramework();
}

bool Live2DRenderer::initFramework() {
    if (m_frameworkInitialized) return true;

    Csm::CubismFramework::Option option;
    option.LogFunction = Live2DPal::printMessage;
    option.LoadFileFunction = s_loadFile;
    option.ReleaseBytesFunction = s_releaseBytes;
    option.LoggingLevel = Csm::CubismFramework::Option::LogLevel_Verbose;

    Csm::CubismFramework::StartUp(&m_allocator, &option);
    Csm::CubismFramework::Initialize();
    m_frameworkInitialized = true;

    Live2DPal::printLog("CubismFramework initialized");
    return true;
}

void Live2DRenderer::disposeFramework() {
    if (!m_frameworkInitialized) return;
    Csm::CubismFramework::Dispose();
    m_frameworkInitialized = false;
}

bool Live2DRenderer::loadModel(const std::string& modelDir, const std::string& modelFileName) {
    std::lock_guard<std::mutex> lock(m_modelMutex);

    if (m_model) {
        delete m_model;
        m_model = nullptr;
    }

    m_model = new Live2DModel();
    m_model->loadAssets(modelDir, modelFileName);

    if (!m_model->GetModel()) {
        Live2DPal::printLog("ERROR: Model load failed: %s%s", modelDir.c_str(), modelFileName.c_str());
        delete m_model;
        m_model = nullptr;
        return false;
    }

    Live2DPal::printLog("Model loaded: %s%s", modelDir.c_str(), modelFileName.c_str());
    return true;
}

void Live2DRenderer::unloadModel() {
    std::lock_guard<std::mutex> lock(m_modelMutex);
    if (m_model) {
        delete m_model;
        m_model = nullptr;
    }
}

void Live2DRenderer::update() {
    Live2DPal::updateTime();
    std::lock_guard<std::mutex> lock(m_modelMutex);
    if (m_model) {
        m_model->update();
    }
}

void Live2DRenderer::draw(int width, int height, float scale, float offsetX, float offsetY) {
    std::lock_guard<std::mutex> lock(m_modelMutex);
    if (!m_model || !m_model->GetModel() || width <= 0 || height <= 0) return;

    float screenRatio = static_cast<float>(width) / static_cast<float>(height);

    Csm::CubismMatrix44 projection;
    projection.LoadIdentity();

    // Combine user scale with aspect ratio correction in one call
    // Scale() sets values directly (not multiplicative), so compute final values
    float scaleX = scale;
    float scaleY = scale;
    if (screenRatio > 1.0f) {
        scaleX /= screenRatio;
    } else {
        scaleY *= screenRatio;
    }
    projection.Scale(scaleX, scaleY);

    // User-controlled offset
    projection.TranslateX(offsetX);
    projection.TranslateY(offsetY);

    m_model->draw(projection);
}

void Live2DRenderer::onTouch(float screenX, float screenY, int viewWidth, int viewHeight) {
    std::lock_guard<std::mutex> lock(m_modelMutex);
    if (!m_model || !m_model->GetModel() || viewWidth <= 0 || viewHeight <= 0) return;

    float screenRatio = static_cast<float>(viewWidth) / static_cast<float>(viewHeight);

    // Screen pixel → NDC (-1 to 1)
    float ndcX = (screenX / viewWidth) * 2.0f - 1.0f;
    float ndcY = -((screenY / viewHeight) * 2.0f - 1.0f);

    // Invert the projection applied in draw() to get model-space coords
    if (screenRatio > 1.0f) {
        ndcX *= screenRatio;
    } else {
        ndcY /= screenRatio;
    }

    m_model->onTouch(ndcX, ndcY);
}

void Live2DRenderer::startMotion(const char* group, int no, int priority) {
    std::lock_guard<std::mutex> lock(m_modelMutex);
    if (m_model) {
        m_model->startMotion(group, no, priority);
    }
}

bool Live2DRenderer::isModelLoaded() const {
    return m_model != nullptr;
}

} // namespace nna::graphics
