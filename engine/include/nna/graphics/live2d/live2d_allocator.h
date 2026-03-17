/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#pragma once

#include <CubismFramework.hpp>
#include <ICubismAllocator.hpp>
#include <cstdlib>

namespace nna::graphics {

class Live2DAllocator : public Csm::ICubismAllocator {
public:
    void* Allocate(const Csm::csmSizeType size) override {
        return std::malloc(size);
    }

    void Deallocate(void* memory) override {
        std::free(memory);
    }

    void* AllocateAligned(const Csm::csmSizeType size, const Csm::csmUint32 alignment) override {
        size_t offset = alignment - 1 + sizeof(void*);
        void* allocation = std::malloc(size + offset);

        size_t alignedAddress = reinterpret_cast<size_t>(allocation) + sizeof(void*);
        size_t shift = alignedAddress % alignment;
        if (shift) {
            alignedAddress += (alignment - shift);
        }

        void** preamble = reinterpret_cast<void**>(alignedAddress);
        preamble[-1] = allocation;

        return reinterpret_cast<void*>(alignedAddress);
    }

    void DeallocateAligned(void* alignedMemory) override {
        void** preamble = static_cast<void**>(alignedMemory);
        std::free(preamble[-1]);
    }
};

} // namespace nna::graphics
