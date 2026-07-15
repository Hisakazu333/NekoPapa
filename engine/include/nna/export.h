#pragma once

#if defined(NNA_STATIC)
    #define NNA_EXPORT
#elif defined(_WIN32)
    #ifdef NNA_BUILDING_LIB
        #define NNA_EXPORT __declspec(dllexport)
    #else
        #define NNA_EXPORT __declspec(dllimport)
    #endif
#else
    #define NNA_EXPORT __attribute__((visibility("default")))
#endif
