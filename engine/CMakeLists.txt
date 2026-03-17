set(ENGINE_SOURCES
    src/engine_stub.cpp
)

if(NNA_ENABLE_LIVE2D)
    list(APPEND ENGINE_SOURCES
        src/graphics/live2d/live2d_pal.cpp
        src/graphics/live2d/live2d_texture.cpp
        src/graphics/live2d/live2d_model.cpp
        src/graphics/live2d/live2d_renderer.cpp
    )
    # Windows: compile GLEW shim (wglGetProcAddress loader)
    if(WIN32)
        list(APPEND ENGINE_SOURCES
            "${CMAKE_CURRENT_SOURCE_DIR}/third_party/glew-shim/src/glew_shim.cpp"
        )
    endif()
endif()

add_library(openneko SHARED ${ENGINE_SOURCES})

target_include_directories(openneko PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
)

target_compile_definitions(openneko PRIVATE NNA_BUILDING_LIB)

if(NNA_ENABLE_LIVE2D)
    target_compile_definitions(openneko PUBLIC NNA_ENABLE_LIVE2D)
    target_compile_definitions(openneko PRIVATE GL_SILENCE_DEPRECATION)
    target_link_libraries(openneko PUBLIC CubismFramework)
    # stb_image header — expect it in engine/third_party/stb/
    target_include_directories(openneko PRIVATE
        "${CMAKE_CURRENT_SOURCE_DIR}/third_party/stb"
    )
    # Windows: GLEW shim include path
    if(WIN32)
        target_include_directories(openneko PRIVATE
            "${CMAKE_CURRENT_SOURCE_DIR}/third_party/glew-shim/include"
        )
    endif()
endif()

set_target_properties(openneko PROPERTIES
    VERSION ${PROJECT_VERSION}
    SOVERSION 0
    OUTPUT_NAME openneko
)
