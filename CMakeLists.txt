cmake_minimum_required(VERSION 3.21)
project(OpenNekoEngine VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

# Build options
option(NNA_BUILD_APP "Build Qt6 desktop application" ON)
option(NNA_ENABLE_LIVE2D "Enable Live2D Cubism SDK integration" OFF)
option(NNA_ENABLE_CORE_NANO "Enable external NekoCore-Nano core integration" ON)
set(NNA_CORE_NANO_SOURCE_DIR
    "${CMAKE_CURRENT_SOURCE_DIR}/../NekoCore-Nano"
    CACHE PATH "Path to the external NekoCore-Nano source tree"
)
set(NNA_HAS_CORE_NANO OFF)

if(NNA_ENABLE_LIVE2D)
    include(FindLive2D)
    if(NOT LIVE2D_FOUND)
        message(WARNING "NNA_ENABLE_LIVE2D is ON but Cubism SDK not found. Live2D disabled.")
        set(NNA_ENABLE_LIVE2D OFF)
    endif()
endif()

add_subdirectory(engine)

if(NNA_ENABLE_CORE_NANO)
    get_filename_component(NNA_CORE_NANO_SOURCE_DIR "${NNA_CORE_NANO_SOURCE_DIR}" ABSOLUTE)
    if(EXISTS "${NNA_CORE_NANO_SOURCE_DIR}/CMakeLists.txt")
        add_subdirectory("${NNA_CORE_NANO_SOURCE_DIR}" "${CMAKE_BINARY_DIR}/NekoCore-Nano")
        set(NNA_HAS_CORE_NANO ON)
        message(STATUS "NekoCore-Nano enabled: ${NNA_CORE_NANO_SOURCE_DIR}")
    else()
        message(WARNING "NNA_ENABLE_CORE_NANO is ON, but NNA_CORE_NANO_SOURCE_DIR was not found: ${NNA_CORE_NANO_SOURCE_DIR}")
    endif()
endif()

if(NNA_BUILD_APP)
    add_subdirectory(app/stage-desktop)
endif()
