cmake_minimum_required(VERSION 3.21)
project(OpenNekoEngine VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

# Build options
option(NNA_BUILD_APP "Build the legacy Qt6 desktop application" OFF)
option(NNA_BUILD_LIVE2D_STAGE "Build the independent native Live2D stage" ON)
option(NNA_ENABLE_LIVE2D "Enable Live2D Cubism SDK integration" ON)
set(NNA_CORE_NANO_MODE "stub" CACHE STRING "NekoCore-Nano integration mode: stub, source, or binary")
set_property(CACHE NNA_CORE_NANO_MODE PROPERTY STRINGS stub source binary)
set(NNA_CORE_NANO_SOURCE_DIR
    "${CMAKE_CURRENT_SOURCE_DIR}/../NekoCore-Nano"
    CACHE PATH "Private NekoCore-Nano source tree used only when NNA_CORE_NANO_MODE=source"
)
set(NNA_CORE_NANO_INCLUDE_DIR
    ""
    CACHE PATH "NekoCore-Nano public include directory used when NNA_CORE_NANO_MODE=binary"
)
set(NNA_CORE_NANO_LIBRARY
    ""
    CACHE FILEPATH "Prebuilt NekoCore-Nano library used when NNA_CORE_NANO_MODE=binary"
)
set(NNA_HAS_CORE_NANO OFF)

string(TOLOWER "${NNA_CORE_NANO_MODE}" NNA_CORE_NANO_MODE)
if(NOT NNA_CORE_NANO_MODE MATCHES "^(stub|source|binary)$")
    message(FATAL_ERROR "NNA_CORE_NANO_MODE must be one of: stub, source, binary")
endif()

if(NNA_ENABLE_LIVE2D)
    include(FindLive2D)
    if(NOT LIVE2D_FOUND)
        message(WARNING "NNA_ENABLE_LIVE2D is ON but Cubism SDK not found. Live2D disabled.")
        set(NNA_ENABLE_LIVE2D OFF)
    endif()
endif()

if(NNA_BUILD_LIVE2D_STAGE AND NOT NNA_ENABLE_LIVE2D)
    message(FATAL_ERROR "NNA_BUILD_LIVE2D_STAGE requires a usable Cubism SDK and NNA_ENABLE_LIVE2D=ON")
endif()

add_subdirectory(engine)

if(NNA_BUILD_LIVE2D_STAGE)
    add_subdirectory(app/live2d-stage)
endif()

if(NNA_CORE_NANO_MODE STREQUAL "source")
    get_filename_component(NNA_CORE_NANO_SOURCE_DIR "${NNA_CORE_NANO_SOURCE_DIR}" ABSOLUTE)
    if(EXISTS "${NNA_CORE_NANO_SOURCE_DIR}/CMakeLists.txt")
        add_subdirectory("${NNA_CORE_NANO_SOURCE_DIR}" "${CMAKE_BINARY_DIR}/NekoCore-Nano")
        set(NNA_HAS_CORE_NANO ON)
        message(STATUS "NekoCore-Nano source mode enabled: ${NNA_CORE_NANO_SOURCE_DIR}")
    else()
        message(FATAL_ERROR "NNA_CORE_NANO_MODE=source, but NNA_CORE_NANO_SOURCE_DIR was not found: ${NNA_CORE_NANO_SOURCE_DIR}")
    endif()
elseif(NNA_CORE_NANO_MODE STREQUAL "binary")
    get_filename_component(NNA_CORE_NANO_INCLUDE_DIR "${NNA_CORE_NANO_INCLUDE_DIR}" ABSOLUTE)
    get_filename_component(NNA_CORE_NANO_LIBRARY "${NNA_CORE_NANO_LIBRARY}" ABSOLUTE)

    if(NOT EXISTS "${NNA_CORE_NANO_INCLUDE_DIR}/nna/c_api/nna_c_api.h")
        message(FATAL_ERROR "NNA_CORE_NANO_MODE=binary requires NNA_CORE_NANO_INCLUDE_DIR with nna/c_api/nna_c_api.h")
    endif()
    if(NOT EXISTS "${NNA_CORE_NANO_LIBRARY}")
        message(FATAL_ERROR "NNA_CORE_NANO_MODE=binary requires NNA_CORE_NANO_LIBRARY to point to a prebuilt library")
    endif()

    add_library(nekocore_nano UNKNOWN IMPORTED GLOBAL)
    set_target_properties(nekocore_nano PROPERTIES
        IMPORTED_LOCATION "${NNA_CORE_NANO_LIBRARY}"
        INTERFACE_INCLUDE_DIRECTORIES "${NNA_CORE_NANO_INCLUDE_DIR}"
    )
    set(NNA_HAS_CORE_NANO ON)
    message(STATUS "NekoCore-Nano binary mode enabled: ${NNA_CORE_NANO_LIBRARY}")
else()
    message(STATUS "NekoCore-Nano stub mode enabled. Private core source is not added to this build.")
endif()

if(NNA_BUILD_APP)
    add_subdirectory(app/stage-desktop)
endif()
