/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#pragma once

#include <CubismFramework.hpp>
#include <string>

namespace nna::graphics {

class Live2DPal {
public:
    static void printLog(const char* format, ...);
    static void printMessage(const char* message);

    static void updateTime();
    static double getDeltaTime();

    static void setModelRootPath(const std::string& path);
    static std::string getModelRootPath();

    static Csm::csmByte* loadFileAsBytes(const std::string& filePath, Csm::csmSizeInt* outSize);
    static void releaseBytes(Csm::csmByte* byteData);
};

} // namespace nna::graphics
