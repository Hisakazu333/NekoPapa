cmake_minimum_required(VERSION 3.24)
project(OpenNekoEngineDesktop LANGUAGES C CXX)

find_package(Qt6 REQUIRED COMPONENTS Quick QuickControls2 OpenGL Network)

qt_policy(SET QTP0001 NEW)
if(Qt6_VERSION VERSION_GREATER_EQUAL "6.8.0")
    qt_policy(SET QTP0004 NEW)
endif()

set(CMAKE_AUTOMOC ON)

if(APPLE)
    enable_language(OBJCXX)
endif()

if(APPLE)
    set(DESKTOP_PLATFORM_SOURCES
        src/nna_macos_dock.h
        src/nna_macos_dock.mm
        src/nna_window_chrome.mm
    )
else()
    set(DESKTOP_PLATFORM_SOURCES
        src/nna_macos_dock.h
        src/nna_macos_dock.cpp
        src/nna_window_chrome.cpp
    )
endif()

set(DESKTOP_SOURCES
    src/main.cpp
    src/app_controller.h
    src/app_controller.cpp
    src/agent_workspace_service.h
    src/agent_workspace_service.cpp
    src/nna_model_manager.h
    src/nna_model_manager.cpp
    src/nna_avatar_canvas.h
    src/nna_avatar_canvas.cpp
    src/live2d_stage_profile.h
    src/live2d_stage_profile.cpp
    src/theme.h
    src/theme.cpp
    src/icons.h
    src/icons.cpp
    src/nna_window_chrome.h
    ${DESKTOP_PLATFORM_SOURCES}
)

qt_add_executable(OpenNekoEngine ${DESKTOP_SOURCES})

# Release: hide console window on Windows. Debug: show console for log output.
set_target_properties(OpenNekoEngine PROPERTIES
    WIN32_EXECUTABLE $<AND:$<PLATFORM_ID:Windows>,$<NOT:$<CONFIG:Debug>>>
)

qt_add_qml_module(OpenNekoEngine
    URI OpenNeko
    VERSION 1.0
    RESOURCES
        qml/assets/home/home-living-room.png
        qml/assets/home/home-stage-room-cat-pillow.png
        qml/assets/icons/line/cat.svg
        qml/assets/icons/line/check.svg
        qml/assets/icons/line/chevron-down.svg
        qml/assets/icons/line/chevron-left.svg
        qml/assets/icons/line/chevron-right.svg
        qml/assets/icons/line/clock.svg
        qml/assets/icons/line/close.svg
        qml/assets/icons/line/cloud.svg
        qml/assets/icons/line/cursor.svg
        qml/assets/icons/line/database.svg
        qml/assets/icons/line/home.svg
        qml/assets/icons/line/info-circle.svg
        qml/assets/icons/line/iot.svg
        qml/assets/icons/line/key-round.svg
        qml/assets/icons/line/lock.svg
        qml/assets/icons/line/monitor.svg
        qml/assets/icons/line/moon.svg
        qml/assets/icons/line/paw.svg
        qml/assets/icons/line/phone.svg
        qml/assets/icons/line/pin.svg
        qml/assets/icons/line/play.svg
        qml/assets/icons/line/refresh.svg
        qml/assets/icons/line/scale.svg
        qml/assets/icons/line/search.svg
        qml/assets/icons/line/send.svg
        qml/assets/icons/line/settings.svg
        qml/assets/icons/line/shield-check.svg
        qml/assets/icons/line/sun.svg
        qml/assets/icons/line/user.svg
        qml/assets/icons/line/volume.svg
        qml/assets/icons/line/wallet.svg
)

# macOS 26+ SDK removed AGL.framework tbd stub
if(APPLE AND TARGET WrapOpenGL::WrapOpenGL)
    get_target_property(_wgl_libs WrapOpenGL::WrapOpenGL INTERFACE_LINK_LIBRARIES)
    if(_wgl_libs)
        list(FILTER _wgl_libs EXCLUDE REGEX "[Aa][Gg][Ll]")
        set_target_properties(WrapOpenGL::WrapOpenGL PROPERTIES INTERFACE_LINK_LIBRARIES "${_wgl_libs}")
    endif()
endif()

target_link_libraries(OpenNekoEngine PRIVATE
    openneko
    Qt6::Quick
    Qt6::QuickControls2
    Qt6::OpenGL
    Qt6::Network
)

if(NNA_HAS_CORE_NANO AND TARGET nekocore_nano)
    target_link_libraries(OpenNekoEngine PRIVATE nekocore_nano)
    target_compile_definitions(OpenNekoEngine PRIVATE NNA_HAS_CORE_NANO=1)
else()
    target_compile_definitions(OpenNekoEngine PRIVATE NNA_HAS_CORE_NANO=0)
endif()

if(APPLE)
    target_link_libraries(OpenNekoEngine PRIVATE
        "-framework AppKit"
        "-framework QuartzCore"
    )
endif()

# Copy/link assets directory next to the executable so NNAModelManager can find models
# Windows: symlinks need admin/dev-mode, so use copy instead
if(WIN32)
    add_custom_command(TARGET OpenNekoEngine POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory_if_different
            "${CMAKE_SOURCE_DIR}/assets"
            "$<TARGET_FILE_DIR:OpenNekoEngine>/assets"
        COMMENT "Copying assets → build output"
    )
else()
    add_custom_command(TARGET OpenNekoEngine POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E create_symlink
            "${CMAKE_SOURCE_DIR}/assets"
            "$<TARGET_FILE_DIR:OpenNekoEngine>/assets"
        COMMENT "Symlinking assets → build output"
    )
endif()
