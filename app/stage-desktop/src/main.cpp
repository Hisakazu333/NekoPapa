/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>
#include <QQuickWindow>
#include <QSurfaceFormat>
#ifdef _WIN32
#include <Windows.h>
#include <cstdio>
#endif
#include "app_controller.h"
#include "nna_model_manager.h"
#include "nna_avatar_canvas.h"
#include "nna_macos_dock.h"
#include "nna_window_chrome.h"
#include "live2d_stage_profile.h"
#include "theme.h"
#include "icons.h"

using namespace Qt::StringLiterals;

int main(int argc, char *argv[])
{
#ifdef _WIN32
    // Always show a console window for debug output on Windows
    AllocConsole();
    freopen("CONOUT$", "w", stdout);
    freopen("CONOUT$", "w", stderr);
#endif
    // Force OpenGL rendering backend (required for QQuickFramebufferObject / Live2D)
    QQuickWindow::setGraphicsApi(QSGRendererInterface::OpenGL);

    QSurfaceFormat format;
#ifdef Q_OS_MACOS
    // macOS: request 2.1 legacy profile (Apple's GL compat layer)
    format.setMajorVersion(2);
    format.setMinorVersion(1);
    format.setProfile(QSurfaceFormat::NoProfile);
#else
    // Windows/Linux: request 3.3 compatibility profile
    // (drivers support this well, and #version 120 shaders still work)
    format.setMajorVersion(3);
    format.setMinorVersion(3);
    format.setProfile(QSurfaceFormat::CompatibilityProfile);
#endif
    format.setDepthBufferSize(24);
    format.setStencilBufferSize(8);
    QSurfaceFormat::setDefaultFormat(format);

    QGuiApplication app(argc, argv);
    app.setApplicationName("OpenNeko Engine");
    app.setOrganizationName("NNA");

    QQuickStyle::setStyle("Basic");

    // Register QML types
    qmlRegisterType<NNAAvatarCanvas>("NNA.Core", 1, 0, "NNAAvatarCanvas");
    qmlRegisterType<NNAMacOSDockView>("NNA.Core", 1, 0, "NNAMacOSDockView");

    NNAModelManager modelManager;
    NNAAppController controller;
    controller.setModelManager(&modelManager);

    QQmlApplicationEngine engine;

    // Register C++ singletons for global Theme and Icons access
    qmlRegisterSingletonType<Theme>("OpenNeko", 1, 0, "Theme",
        [](QQmlEngine*, QJSEngine*) -> QObject* { return new Theme(); });
    qmlRegisterSingletonType<Icons>("OpenNeko", 1, 0, "Icons",
        [](QQmlEngine*, QJSEngine*) -> QObject* { return new Icons(); });
    qmlRegisterSingletonType<Live2DStageProfile>("OpenNeko", 1, 0, "Live2DStageProfile",
        [](QQmlEngine*, QJSEngine*) -> QObject* { return new Live2DStageProfile(); });

    engine.rootContext()->setContextProperty("appController", &controller);
    engine.rootContext()->setContextProperty("modelManager", &modelManager);

    qDebug() << "[main] Loading QML...";
    engine.load(QUrl(u"qrc:/qt/qml/OpenNeko/qml/main.qml"_s));
    qDebug() << "[main] QML loaded, rootObjects:" << engine.rootObjects().size();

    if (engine.rootObjects().isEmpty()) {
        qCritical() << "[main] QML load failed!";
        return -1;
    }

    if (auto *window = qobject_cast<QWindow *>(engine.rootObjects().constFirst())) {
        NNAWindowChrome::applyMainWindowChrome(window);
        window->show();
    }

    qDebug() << "[main] Entering event loop...";
    return app.exec();
}
