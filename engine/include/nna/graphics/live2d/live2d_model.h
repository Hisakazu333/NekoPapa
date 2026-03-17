/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#pragma once

#include <CubismFramework.hpp>
#include <Model/CubismUserModel.hpp>
#include <CubismModelSettingJson.hpp>
#include <Effect/CubismEyeBlink.hpp>
#include <Effect/CubismBreath.hpp>
#include <Effect/CubismPose.hpp>
#include "live2d_texture.h"
#include <map>
#include <string>

namespace nna::graphics {

class Live2DModel : public Csm::CubismUserModel {
public:
    Live2DModel();
    virtual ~Live2DModel();

    void loadAssets(const std::string& dir, const std::string& fileName);
    void update();
    void draw(Csm::CubismMatrix44& projection);

    void onTouch(float x, float y);
    Csm::CubismMotionQueueEntryHandle startMotion(
        const Csm::csmChar* group, Csm::csmInt32 no, Csm::csmInt32 priority);

protected:
    void DoDraw();

private:
    Live2DTextureManager* m_textureManager;
    Csm::CubismModelSettingJson* m_modelSetting;
    std::string m_modelHomeDir;
    Csm::csmFloat32 m_userTimeSeconds;

    Csm::CubismEyeBlink* m_eyeBlink;
    Csm::CubismBreath* m_breath;
    Csm::CubismPose* m_pose;
    std::map<std::string, Csm::ACubismMotion*> m_motions;
};

} // namespace nna::graphics
