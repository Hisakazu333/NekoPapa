# FindLive2D.cmake
# Locates Cubism SDK for Native and builds the Framework as a static library.
#
# Expected SDK layout:
#   engine/third_party/CubismSdkForNative/
#     Core/
#       include/
#       lib/windows/x86_64/          (Live2DCubismCore.lib)
#       lib/macos/x86_64/            (libLive2DCubismCore.a)
#       lib/macos/arm64/             (libLive2DCubismCore.a)
#     Framework/
#       src/
#
# Outputs:
#   LIVE2D_FOUND
#   CubismCore      — imported static library target
#   CubismFramework  — static library target (compiled from Framework sources)

# Auto-detect versioned subdirectory (e.g. CubismSdkForNative-5-r.4.1/)
set(_CUBISM_BASE "${CMAKE_CURRENT_SOURCE_DIR}/engine/third_party/CubismSdkForNative")
if(EXISTS "${_CUBISM_BASE}/Core/include")
    set(CUBISM_SDK_ROOT "${_CUBISM_BASE}")
else()
    file(GLOB _CUBISM_SUBDIRS "${_CUBISM_BASE}/CubismSdkForNative-*")
    list(LENGTH _CUBISM_SUBDIRS _CUBISM_COUNT)
    if(_CUBISM_COUNT GREATER 0)
        list(GET _CUBISM_SUBDIRS 0 CUBISM_SDK_ROOT)
    else()
        set(CUBISM_SDK_ROOT "${_CUBISM_BASE}")
    endif()
endif()

# --- Core include ---
set(CUBISM_CORE_INCLUDE "${CUBISM_SDK_ROOT}/Core/include")
if(NOT EXISTS "${CUBISM_CORE_INCLUDE}")
    message(WARNING "Cubism SDK Core headers not found at ${CUBISM_CORE_INCLUDE}")
    set(LIVE2D_FOUND FALSE)
    return()
endif()

# --- Core library ---
if(WIN32)
    # Cubism SDK organizes Windows libs by arch and MSVC toolset version:
    #   windows/x86_64/{140,141,142,143}/Live2DCubismCore_{MD,MT,MDd,MTd}.lib
    # Detect MSVC toolset and pick the right one.
    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
        set(_CSM_ARCH "x86_64")
    else()
        set(_CSM_ARCH "x86")
    endif()

    # Map MSVC toolset version
    if(MSVC_TOOLSET_VERSION)
        set(_CSM_TOOLSET "${MSVC_TOOLSET_VERSION}")
    else()
        set(_CSM_TOOLSET "143")  # VS 2022 default
    endif()

    # Try exact toolset, then fall back to available ones (newest first)
    set(_CSM_WIN_BASE "${CUBISM_SDK_ROOT}/Core/lib/windows/${_CSM_ARCH}")
    set(CUBISM_CORE_LIB "")
    foreach(_ts ${_CSM_TOOLSET} 143 142 141 140)
        if(EXISTS "${_CSM_WIN_BASE}/${_ts}/Live2DCubismCore_MD.lib")
            set(CUBISM_CORE_LIB "${_CSM_WIN_BASE}/${_ts}/Live2DCubismCore_MD.lib")
            break()
        endif()
    endforeach()
elseif(APPLE)
    # Prefer arm64 on Apple Silicon, fallback to x86_64
    if(CMAKE_OSX_ARCHITECTURES MATCHES "arm64" OR CMAKE_SYSTEM_PROCESSOR MATCHES "arm64")
        set(CUBISM_CORE_LIB "${CUBISM_SDK_ROOT}/Core/lib/macos/arm64/libLive2DCubismCore.a")
    else()
        set(CUBISM_CORE_LIB "${CUBISM_SDK_ROOT}/Core/lib/macos/x86_64/libLive2DCubismCore.a")
    endif()
    # Universal binary fallback
    if(NOT EXISTS "${CUBISM_CORE_LIB}")
        set(CUBISM_CORE_LIB "${CUBISM_SDK_ROOT}/Core/lib/macos/libLive2DCubismCore.a")
    endif()
else()
    set(CUBISM_CORE_LIB "${CUBISM_SDK_ROOT}/Core/lib/linux/x86_64/libLive2DCubismCore.a")
endif()

if(NOT EXISTS "${CUBISM_CORE_LIB}")
    message(WARNING "Cubism Core library not found at ${CUBISM_CORE_LIB}")
    set(LIVE2D_FOUND FALSE)
    return()
endif()

# Imported target for Core
add_library(CubismCore STATIC IMPORTED GLOBAL)
set_target_properties(CubismCore PROPERTIES
    IMPORTED_LOCATION "${CUBISM_CORE_LIB}"
    INTERFACE_INCLUDE_DIRECTORIES "${CUBISM_CORE_INCLUDE}"
)

# --- Framework (compile from source) ---
set(CUBISM_FRAMEWORK_SRC "${CUBISM_SDK_ROOT}/Framework/src")
if(NOT EXISTS "${CUBISM_FRAMEWORK_SRC}")
    message(WARNING "Cubism Framework sources not found at ${CUBISM_FRAMEWORK_SRC}")
    set(LIVE2D_FOUND FALSE)
    return()
endif()

# Collect all Framework sources, then exclude renderers we don't need
file(GLOB_RECURSE CUBISM_FRAMEWORK_SOURCES "${CUBISM_FRAMEWORK_SRC}/*.cpp")

# Remove D3D9, D3D11, Vulkan, Metal, Cocos renderers — only keep OpenGL
list(FILTER CUBISM_FRAMEWORK_SOURCES EXCLUDE REGEX "Rendering/D3D9/")
list(FILTER CUBISM_FRAMEWORK_SOURCES EXCLUDE REGEX "Rendering/D3D11/")
list(FILTER CUBISM_FRAMEWORK_SOURCES EXCLUDE REGEX "Rendering/Vulkan/")
list(FILTER CUBISM_FRAMEWORK_SOURCES EXCLUDE REGEX "Rendering/Metal/")
list(FILTER CUBISM_FRAMEWORK_SOURCES EXCLUDE REGEX "Rendering/Cocos2d/")

add_library(CubismFramework STATIC ${CUBISM_FRAMEWORK_SOURCES})

target_include_directories(CubismFramework PUBLIC
    "${CUBISM_FRAMEWORK_SRC}"
    "${CUBISM_CORE_INCLUDE}"
)

# Platform-specific OpenGL setup
if(APPLE)
    # macOS: use desktop OpenGL
    # CSM_TARGET_MAC_GL enables macOS GL includes in Framework
    # CSM_TARGET_COCOS skips the GLEW include (not needed on macOS)
    find_package(OpenGL REQUIRED)
    target_link_libraries(CubismFramework PUBLIC OpenGL::GL)
    target_compile_definitions(CubismFramework PUBLIC CSM_TARGET_MAC_GL CSM_TARGET_COCOS)
elseif(WIN32)
    find_package(OpenGL REQUIRED)
    target_link_libraries(CubismFramework PUBLIC OpenGL::GL)
    target_compile_definitions(CubismFramework PUBLIC CSM_TARGET_WIN_GL)
    # Use our minimal GLEW shim (wglGetProcAddress-based) instead of full GLEW
    set(GLEW_SHIM_DIR "${CMAKE_CURRENT_SOURCE_DIR}/engine/third_party/glew-shim")
    target_include_directories(CubismFramework PUBLIC "${GLEW_SHIM_DIR}/include")
    # Build the shim as part of the engine library (added in engine/CMakeLists.txt)
else()
    find_package(OpenGL REQUIRED)
    target_link_libraries(CubismFramework PUBLIC OpenGL::GL)
    target_compile_definitions(CubismFramework PUBLIC CSM_TARGET_LINUX_GL)
endif()

target_link_libraries(CubismFramework PUBLIC CubismCore)

# Suppress warnings in third-party code
if(MSVC)
    target_compile_options(CubismFramework PRIVATE /W0)
else()
    target_compile_options(CubismFramework PRIVATE -w)
endif()

set(LIVE2D_FOUND TRUE)
message(STATUS "Live2D Cubism SDK found: ${CUBISM_SDK_ROOT}")
