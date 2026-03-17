find_package(Qt6 REQUIRED COMPONENTS Quick QuickControls2 OpenGL)

qt_policy(SET QTP0001 NEW)
if(Qt6_VERSION VERSION_GREATER_EQUAL "6.8.0")
    qt_policy(SET QTP0004 NEW)
endif()

set(CMAKE_AUTOMOC ON)

set(DESKTOP_SOURCES
    src/main.cpp
    src/app_controller.h
    src/app_controller.cpp
    src/nna_model_manager.h
    src/nna_model_manager.cpp
    src/nna_avatar_canvas.h
    src/nna_avatar_canvas.cpp
)

qt_add_executable(OpenNekoEngine ${DESKTOP_SOURCES})

set_target_properties(OpenNekoEngine PROPERTIES WIN32_EXECUTABLE $<IF:$<PLATFORM_ID:Windows>,TRUE,FALSE>)

qt_add_qml_module(OpenNekoEngine
    URI OpenNeko
    VERSION 1.0
    QML_FILES
        qml/main.qml
        qml/NNASidebar.qml
        qml/HomePage.qml
        qml/SoulPage.qml
        qml/AbilityPage.qml
        qml/WorldPage.qml
        qml/ChatPage.qml
        qml/CharacterPage.qml
        qml/MemoryPage.qml
        qml/DreamPage.qml
        qml/StatusPage.qml
        qml/ToolCallPage.qml
        qml/AgentPage.qml
        qml/EvolutionPage.qml
        qml/PerceptionPage.qml
        qml/IoTPage.qml
        qml/SettingsPage.qml
        qml/components/PlaceholderPage.qml
        qml/components/NNAStatusCard.qml
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
)

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
