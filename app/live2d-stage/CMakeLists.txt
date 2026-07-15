include(FetchContent)

if(NOT TARGET openneko_static)
    message(FATAL_ERROR "live2d-stage requires the openneko_static target")
endif()
if(NOT NNA_ENABLE_LIVE2D)
    message(FATAL_ERROR "live2d-stage requires NNA_ENABLE_LIVE2D=ON")
endif()

if(APPLE)
    enable_language(OBJC)
endif()

find_package(OpenGL REQUIRED)
find_package(Threads REQUIRED)
find_package(glfw3 3.4 CONFIG QUIET)

if(NOT TARGET glfw AND NOT TARGET glfw3::glfw)
    set(GLFW_BUILD_DOCS OFF CACHE BOOL "" FORCE)
    set(GLFW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
    set(GLFW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
    set(GLFW_INSTALL OFF CACHE BOOL "" FORCE)
    FetchContent_Declare(
        glfw
        GIT_REPOSITORY https://github.com/glfw/glfw.git
        GIT_TAG a74efa0d5628b74adc0426af4c5710e287fa7c2c
    )
    FetchContent_MakeAvailable(glfw)
endif()

if(TARGET glfw)
    set(OPENNEKO_GLFW_TARGET glfw)
elseif(TARGET glfw3::glfw)
    set(OPENNEKO_GLFW_TARGET glfw3::glfw)
else()
    message(FATAL_ERROR "GLFW 3.4 target was not created")
endif()

if(NOT TARGET nlohmann_json::nlohmann_json)
    set(JSON_BuildTests OFF CACHE INTERNAL "")
    set(JSON_Install OFF CACHE INTERNAL "")
    FetchContent_Declare(
        nlohmann_json
        GIT_REPOSITORY https://github.com/nlohmann/json.git
        GIT_TAG v3.11.3
        GIT_SHALLOW TRUE
    )
    FetchContent_MakeAvailable(nlohmann_json)
endif()

add_executable(openneko_live2d_stage
    src/main.cpp
    src/stage_options.cpp
    src/stage_options.h
    src/stage_runtime.cpp
    src/stage_runtime.h
)

set_target_properties(openneko_live2d_stage PROPERTIES
    OUTPUT_NAME openneko-live2d-stage
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
)

target_compile_features(openneko_live2d_stage PRIVATE cxx_std_17)
target_compile_definitions(openneko_live2d_stage PRIVATE GLFW_INCLUDE_NONE)

if(APPLE)
    target_compile_definitions(openneko_live2d_stage PRIVATE GL_SILENCE_DEPRECATION)
endif()

target_link_libraries(openneko_live2d_stage PRIVATE
    openneko_static
    ${OPENNEKO_GLFW_TARGET}
    nlohmann_json::nlohmann_json
    OpenGL::GL
    Threads::Threads
)
