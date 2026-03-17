cmake_minimum_required(VERSION 3.21)
project(OpenNekoEngine VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

# Build options
option(NNA_BUILD_APP "Build Qt6 desktop application" ON)
option(NNA_ENABLE_LIVE2D "Enable Live2D Cubism SDK integration" OFF)

if(NNA_ENABLE_LIVE2D)
    include(FindLive2D)
    if(NOT LIVE2D_FOUND)
        message(WARNING "NNA_ENABLE_LIVE2D is ON but Cubism SDK not found. Live2D disabled.")
        set(NNA_ENABLE_LIVE2D OFF)
    endif()
endif()

add_subdirectory(engine)

if(NNA_BUILD_APP)
    add_subdirectory(app/stage-desktop)
endif()
