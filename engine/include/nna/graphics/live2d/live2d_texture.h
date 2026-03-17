/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#pragma once

#include <string>
#include <vector>

#ifdef _WIN32
#include <GL/glew.h>
#include <GL/gl.h>
#elif defined(__APPLE__)
#include <OpenGL/gl.h>
#else
#include <GL/gl.h>
#endif

namespace nna::graphics {

class Live2DTextureManager {
public:
    struct TextureInfo {
        GLuint m_id = 0;
        int m_width = 0;
        int m_height = 0;
        std::string m_fileName;
    };

    Live2DTextureManager();
    ~Live2DTextureManager();

    TextureInfo* createTextureFromPngFile(const std::string& fileName);
    void releaseTextures();

private:
    std::vector<TextureInfo*> m_textures;
};

} // namespace nna::graphics
