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
#include "app_controller.h"
#include "nna_model_manager.h"
#include "nna_avatar_canvas.h"

using namespace Qt::StringLiterals;

int main(int argc, char *argv[])
{
    // Force OpenGL rendering backend (required for QQuickFramebufferObject / Live2D)
    QQuickWindow::setGraphicsApi(QSGRendererInterface::OpenGL);

    // Use OpenGL 2.1 compatibility profile so Cubism SDK's GLSL #version 100 shaders work
    QSurfaceFormat format;
    format.setMajorVersion(2);
    format.setMinorVersion(1);
    format.setProfile(QSurfaceFormat::NoProfile);
    format.setDepthBufferSize(24);
    format.setStencilBufferSize(8);
    QSurfaceFormat::setDefaultFormat(format);

    QGuiApplication app(argc, argv);
    app.setApplicationName("OpenNeko Engine");
    app.setOrganizationName("NNA");

    QQuickStyle::setStyle("Basic");

    // Register QML types
    qmlRegisterType<NNAAvatarCanvas>("NNA.Core", 1, 0, "NNAAvatarCanvas");

    NNAModelManager modelManager;
    NNAAppController controller;
    controller.setModelManager(&modelManager);

    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty("appController", &controller);
    engine.rootContext()->setContextProperty("modelManager", &modelManager);

    engine.load(QUrl(u"qrc:/qt/qml/OpenNeko/qml/main.qml"_s));

    if (engine.rootObjects().isEmpty())
        return -1;

    return app.exec();
}
