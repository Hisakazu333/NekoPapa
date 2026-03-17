/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#include "nna/graphics/live2d/live2d_texture.h"
#include "nna/graphics/live2d/live2d_pal.h"

#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

namespace nna::graphics {

Live2DTextureManager::Live2DTextureManager() {}

Live2DTextureManager::~Live2DTextureManager() {
    releaseTextures();
}

Live2DTextureManager::TextureInfo* Live2DTextureManager::createTextureFromPngFile(
    const std::string& fileName) {
    // Check cache
    for (auto* tex : m_textures) {
        if (tex->m_fileName == fileName) {
            return tex;
        }
    }

    // Load file bytes
    Csm::csmSizeInt size;
    Csm::csmByte* data = Live2DPal::loadFileAsBytes(fileName, &size);
    if (!data) {
        return nullptr;
    }

    // Decode PNG
    int width, height, channels;
    unsigned char* pixelData = stbi_load_from_memory(
        reinterpret_cast<const unsigned char*>(data),
        static_cast<int>(size),
        &width, &height, &channels, 4);

    Live2DPal::releaseBytes(data);

    if (!pixelData) {
        Live2DPal::printLog("ERROR: Failed to decode texture: %s", fileName.c_str());
        return nullptr;
    }

    // Premultiply alpha
    for (int i = 0; i < width * height; i++) {
        unsigned char* p = &pixelData[i * 4];
        float a = p[3] / 255.0f;
        p[0] = static_cast<unsigned char>(p[0] * a);
        p[1] = static_cast<unsigned char>(p[1] * a);
        p[2] = static_cast<unsigned char>(p[2] * a);
    }

    // Create OpenGL texture
    GLuint textureId;
    glGenTextures(1, &textureId);
    glBindTexture(GL_TEXTURE_2D, textureId);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0,
                 GL_RGBA, GL_UNSIGNED_BYTE, pixelData);
    glGenerateMipmap(GL_TEXTURE_2D);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

    stbi_image_free(pixelData);

    auto* info = new TextureInfo();
    info->m_id = textureId;
    info->m_width = width;
    info->m_height = height;
    info->m_fileName = fileName;
    m_textures.push_back(info);

    Live2DPal::printLog("Texture loaded: %s (ID:%d, %dx%d)", fileName.c_str(), textureId, width, height);
    return info;
}

void Live2DTextureManager::releaseTextures() {
    for (auto* tex : m_textures) {
        glDeleteTextures(1, &tex->m_id);
        delete tex;
    }
    m_textures.clear();
}

} // namespace nna::graphics
