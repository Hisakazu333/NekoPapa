set(ENGINE_SOURCES
    src/engine_stub.cpp
)

if(NNA_ENABLE_LIVE2D)
    list(APPEND ENGINE_SOURCES
        src/graphics/live2d/live2d_pal.cpp
        src/graphics/live2d/live2d_texture.cpp
        src/graphics/live2d/live2d_model.cpp
        src/graphics/live2d/live2d_stage_driver.cpp
        src/graphics/live2d/live2d_renderer.cpp
    )
endif()

function(nna_configure_engine_target target_name)
    target_include_directories(${target_name} PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
    )

    if(NNA_ENABLE_LIVE2D)
        target_compile_definitions(${target_name} PUBLIC NNA_ENABLE_LIVE2D)
        target_compile_definitions(${target_name} PRIVATE GL_SILENCE_DEPRECATION)
        target_link_libraries(${target_name} PUBLIC CubismFramework)
        target_include_directories(${target_name} PRIVATE
            "${CMAKE_CURRENT_SOURCE_DIR}/third_party/stb"
        )
    endif()
endfunction()

add_library(openneko SHARED ${ENGINE_SOURCES})
target_compile_definitions(openneko PRIVATE NNA_BUILDING_LIB)
nna_configure_engine_target(openneko)
set_target_properties(openneko PROPERTIES
    VERSION ${PROJECT_VERSION}
    SOVERSION 0
    OUTPUT_NAME openneko
)

if(NNA_BUILD_LIVE2D_STAGE)
    add_library(openneko_static STATIC ${ENGINE_SOURCES})
    target_compile_definitions(openneko_static PUBLIC NNA_STATIC)
    nna_configure_engine_target(openneko_static)
    set_target_properties(openneko_static PROPERTIES
        OUTPUT_NAME openneko
        POSITION_INDEPENDENT_CODE ON
    )
endif()
