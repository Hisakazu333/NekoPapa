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
    QML_FILES
        qml/main.qml
        qml/core/Theme.qml
        qml/core/Icons.qml
        qml/core/NNABaseButton.qml
        qml/core/NNABaseCard.qml
        qml/core/NNABaseInput.qml
        qml/core/ShapeIcon.qml
        qml/core/NNAAppShell.qml
        qml/windows/DesktopCompanionWindow.qml
        qml/windows/AgentWorkspaceWindow.qml
        qml/features/home/HomeView.qml
        qml/features/home/HomeState.qml
        qml/features/home/HomeStore.qml
        qml/features/home/components/HomeAvatarArea.qml
        qml/features/home/components/HomeChatBubble.qml
        qml/features/home/components/HomeChatList.qml
        qml/features/home/components/HomeHudPanel.qml
        qml/features/home/components/HomeInputBar.qml
        qml/features/home/components/HomeModelAdjustDrawer.qml
        qml/features/home/components/HomeParticleBg.qml
        qml/features/home/components/HomeUserChip.qml
        qml/features/home/components/HomeFunctionRing.qml
        qml/features/home/components/HomeHudOrbs.qml
        qml/features/home/components/HomeQuickActions.qml
        qml/features/home/components/HomeChatOverlay.qml
        qml/features/home/components/HomeSidePanel.qml
        qml/features/home/components/HomeModalCard.qml
        qml/features/chat/ChatView.qml
        qml/features/chat/ChatState.qml
        qml/features/chat/ChatStore.qml
        qml/features/soul/SoulView.qml
        qml/features/soul/SoulState.qml
        qml/features/soul/SoulStore.qml
        qml/features/soul/memory/MemoryView.qml
        qml/features/soul/memory/MemoryState.qml
        qml/features/soul/memory/MemoryStore.qml
        qml/features/soul/status/StatusView.qml
        qml/features/soul/status/StatusState.qml
        qml/features/soul/status/StatusStore.qml
        qml/features/soul/character/CharacterView.qml
        qml/features/soul/character/CharacterState.qml
        qml/features/soul/character/CharacterStore.qml
        qml/features/soul/dream/DreamView.qml
        qml/features/soul/dream/DreamState.qml
        qml/features/soul/dream/DreamStore.qml
        qml/features/ability/AbilityView.qml
        qml/features/ability/toolcall/ToolCallView.qml
        qml/features/ability/agent/AgentView.qml
        qml/features/ability/evolution/EvolutionView.qml
        qml/features/world/WorldView.qml
        qml/features/world/perception/PerceptionView.qml
        qml/features/world/iot/IoTView.qml
        qml/features/mine/NNAMineView.qml
        qml/features/settings/SettingsView.qml
        qml/features/settings/SettingsState.qml
        qml/features/settings/SettingsStore.qml
        qml/features/settings/components/SettingsSidebar.qml
        qml/features/settings/components/SettingsGroup.qml
        qml/features/settings/components/SettingsRow.qml
        qml/features/settings/components/SettingsCategoryGeneral.qml
        qml/features/settings/components/SettingsCategoryEngine.qml
        qml/features/settings/components/SettingsCategoryAI.qml
        qml/features/settings/components/SettingsCategoryPrivacy.qml
        qml/features/settings/components/SettingsCategoryPet.qml
        qml/features/settings/components/SettingsCategoryAbout.qml
    RESOURCES
        qml/assets/home/home-living-room.png
        qml/assets/home/home-stage-room-cat-pillow.png
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
    target_include_directories(OpenNekoEngine PRIVATE
        "${NNA_CORE_NANO_SOURCE_DIR}/include"
    )
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
