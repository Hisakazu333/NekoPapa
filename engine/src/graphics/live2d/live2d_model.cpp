/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#include "nna/graphics/live2d/live2d_model.h"
#include "nna/graphics/live2d/live2d_pal.h"
#include <CubismModelSettingJson.hpp>
#include <Motion/CubismMotion.hpp>
#include <Physics/CubismPhysics.hpp>
#include <Id/CubismIdManager.hpp>
#include <Rendering/OpenGL/CubismRenderer_OpenGLES2.hpp>

using namespace Csm;

namespace nna::graphics {

Live2DModel::Live2DModel()
    : m_textureManager(new Live2DTextureManager())
    , m_modelSetting(nullptr)
    , m_userTimeSeconds(0.0f)
    , m_eyeBlink(nullptr)
    , m_breath(nullptr)
    , m_pose(nullptr)
{
    // _modelMatrix is created by CubismUserModel::LoadModel() with proper canvas dimensions
}

Live2DModel::~Live2DModel() {
    DeleteRenderer();

    if (m_modelSetting) { delete m_modelSetting; m_modelSetting = nullptr; }
    if (m_textureManager) { delete m_textureManager; m_textureManager = nullptr; }
    if (m_eyeBlink) { CubismEyeBlink::Delete(m_eyeBlink); m_eyeBlink = nullptr; }
    if (m_breath) { CubismBreath::Delete(m_breath); m_breath = nullptr; }
    if (m_pose) { CubismPose::Delete(m_pose); m_pose = nullptr; }

    for (auto& item : m_motions) {
        if (item.second) {
            CubismMotion::Delete(item.second);
        }
    }
    m_motions.clear();
}

void Live2DModel::loadAssets(const std::string& dir, const std::string& fileName) {
    m_modelHomeDir = dir;

    Live2DPal::printLog("LoadAssets: dir=%s file=%s", dir.c_str(), fileName.c_str());

    // 1. Load .model3.json
    csmSizeInt size;
    const std::string path = dir + fileName;
    csmByte* buffer = Live2DPal::loadFileAsBytes(path, &size);
    if (!buffer) {
        Live2DPal::printLog("ERROR: Failed to load model setting: %s", path.c_str());
        return;
    }

    m_modelSetting = new CubismModelSettingJson(buffer, size);
    Live2DPal::releaseBytes(buffer);

    // 2. Load .moc3
    const std::string modelFileName = m_modelSetting->GetModelFileName();
    if (!modelFileName.empty()) {
        const std::string modelPath = dir + modelFileName;
        buffer = Live2DPal::loadFileAsBytes(modelPath, &size);
        if (buffer) {
            LoadModel(buffer, size);
            Live2DPal::releaseBytes(buffer);
        }
    }

    // 3. Create renderer
    if (_model) {
        CreateRenderer();
        auto* renderer = GetRenderer<Rendering::CubismRenderer_OpenGLES2>();
        if (renderer) {
            renderer->UseHighPrecisionMask(true);
            renderer->SetClippingMaskBufferSize(2048.0f, 2048.0f);
            renderer->IsPremultipliedAlpha(true);
        }
    }

    // 4. Load textures
    int textureCount = m_modelSetting->GetTextureCount();
    for (int i = 0; i < textureCount; i++) {
        std::string texturePath = dir + m_modelSetting->GetTextureFileName(i);
        auto* tex = m_textureManager->createTextureFromPngFile(texturePath);
        if (tex) {
            GetRenderer<Rendering::CubismRenderer_OpenGLES2>()->BindTexture(i, tex->m_id);
        }
    }

    // 5. Pose
    if (std::strcmp(m_modelSetting->GetPoseFileName(), "") != 0) {
        std::string posePath = dir + m_modelSetting->GetPoseFileName();
        buffer = Live2DPal::loadFileAsBytes(posePath, &size);
        if (buffer) {
            m_pose = CubismPose::Create(buffer, size);
            Live2DPal::releaseBytes(buffer);
        }
    }

    // 6. Eye blink
    if (m_modelSetting->GetEyeBlinkParameterCount() > 0) {
        m_eyeBlink = CubismEyeBlink::Create(m_modelSetting);
    }

    // 7. Breath
    m_breath = CubismBreath::Create();
    csmVector<CubismBreath::BreathParameterData> breathParams;

    CubismBreath::BreathParameterData p1;
    p1.ParameterId = CubismFramework::GetIdManager()->GetId("ParamAngleX");
    p1.Offset = 0.0f; p1.Peak = 15.0f; p1.Cycle = 6.5345f; p1.Weight = 0.5f;
    breathParams.PushBack(p1);

    CubismBreath::BreathParameterData p2;
    p2.ParameterId = CubismFramework::GetIdManager()->GetId("ParamAngleY");
    p2.Offset = 0.0f; p2.Peak = 8.0f; p2.Cycle = 3.5345f; p2.Weight = 0.5f;
    breathParams.PushBack(p2);

    CubismBreath::BreathParameterData p3;
    p3.ParameterId = CubismFramework::GetIdManager()->GetId("ParamAngleZ");
    p3.Offset = 0.0f; p3.Peak = 10.0f; p3.Cycle = 5.5345f; p3.Weight = 0.5f;
    breathParams.PushBack(p3);

    CubismBreath::BreathParameterData p4;
    p4.ParameterId = CubismFramework::GetIdManager()->GetId("ParamBodyAngleX");
    p4.Offset = 0.0f; p4.Peak = 4.0f; p4.Cycle = 15.5345f; p4.Weight = 0.5f;
    breathParams.PushBack(p4);

    CubismBreath::BreathParameterData p5;
    p5.ParameterId = CubismFramework::GetIdManager()->GetId("ParamBreath");
    p5.Offset = 0.5f; p5.Peak = 0.5f; p5.Cycle = 3.2345f; p5.Weight = 0.5f;
    breathParams.PushBack(p5);

    m_breath->SetParameters(breathParams);

    // 8. Physics
    if (std::strcmp(m_modelSetting->GetPhysicsFileName(), "") != 0) {
        std::string physicsPath = dir + m_modelSetting->GetPhysicsFileName();
        buffer = Live2DPal::loadFileAsBytes(physicsPath, &size);
        if (buffer) {
            _physics = CubismPhysics::Create(buffer, size);
            Live2DPal::releaseBytes(buffer);
        }
    }

    // 9. Layout — let Cubism's default model matrix handle scaling
    // CubismUserModel::LoadModel() sets _modelMatrix with SetHeight(2.0)
    // which maps the model to fill NDC space. Do NOT reset to identity.

    Live2DPal::printLog("LoadAssets complete");
}

void Live2DModel::update() {
    const csmFloat32 dt = static_cast<csmFloat32>(Live2DPal::getDeltaTime());
    m_userTimeSeconds += dt;

    if (m_eyeBlink) { m_eyeBlink->UpdateParameters(_model, dt); }
    if (m_breath) { m_breath->UpdateParameters(_model, dt); }
    if (m_pose) { m_pose->UpdateParameters(_model, dt); }

    if (_model) {
        _model->SaveParameters();
        if (_motionManager) { _motionManager->UpdateMotion(_model, dt); }
        _model->LoadParameters();
        _model->Update();
    }
}

void Live2DModel::draw(CubismMatrix44& projection) {
    if (!_model) return;
    projection.MultiplyByMatrix(_modelMatrix);
    GetRenderer<Rendering::CubismRenderer_OpenGLES2>()->SetMvpMatrix(&projection);
    GetRenderer<Rendering::CubismRenderer_OpenGLES2>()->DrawModel();
}

void Live2DModel::DoDraw() {
    // Rendering handled in draw()
}

void Live2DModel::onTouch(float x, float y) {
    Live2DPal::printLog("OnTouch x:%.2f y:%.2f", x, y);

    CubismIdHandle bodyId = CubismFramework::GetIdManager()->GetId("Body");
    if (IsHit(bodyId, x, y)) {
        startMotion("Tap@Body", 0, 3);
    } else {
        startMotion("Tap", 0, 3);
    }
}

CubismMotionQueueEntryHandle Live2DModel::startMotion(
    const csmChar* group, csmInt32 no, csmInt32 priority) {
    if (priority == 3) {
        _motionManager->SetReservePriority(priority);
    } else if (!_motionManager->ReserveMotion(priority)) {
        return InvalidMotionQueueEntryHandleValue;
    }

    const std::string fileName = m_modelSetting->GetMotionFileName(group, no);
    if (fileName.empty()) {
        return InvalidMotionQueueEntryHandleValue;
    }

    char buf[64];
    std::snprintf(buf, sizeof(buf), "%s_%d", group, no);
    std::string name = buf;

    auto* motion = static_cast<CubismMotion*>(m_motions[name]);
    if (!motion) {
        std::string motionPath = m_modelHomeDir + fileName;
        csmSizeInt size;
        csmByte* data = Live2DPal::loadFileAsBytes(motionPath, &size);
        if (!data) return InvalidMotionQueueEntryHandleValue;

        motion = static_cast<CubismMotion*>(CubismMotion::Create(data, size));
        Live2DPal::releaseBytes(data);

        if (motion) {
            csmFloat32 fadeIn = m_modelSetting->GetMotionFadeInTimeValue(group, no);
            csmFloat32 fadeOut = m_modelSetting->GetMotionFadeOutTimeValue(group, no);
            motion->SetFadeInTime(fadeIn >= 0.0f ? fadeIn : 1.0f);
            motion->SetFadeOutTime(fadeOut >= 0.0f ? fadeOut : 1.0f);
        }
        m_motions[name] = motion;
    }

    if (motion) {
        return _motionManager->StartMotionPriority(motion, false, priority);
    }
    return InvalidMotionQueueEntryHandleValue;
}

} // namespace nna::graphics
