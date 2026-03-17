/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#pragma once

#include <QQuickFramebufferObject>
#include <QString>

#ifdef NNA_ENABLE_LIVE2D
#include "nna/graphics/live2d/live2d_renderer.h"
#endif

class NNAAvatarCanvas : public QQuickFramebufferObject {
    Q_OBJECT
    Q_PROPERTY(QString modelPath READ modelPath WRITE setModelPath NOTIFY modelPathChanged)
    Q_PROPERTY(bool modelLoaded READ modelLoaded NOTIFY modelLoadedChanged)
    Q_PROPERTY(float modelScale READ modelScale WRITE setModelScale NOTIFY modelScaleChanged)
    Q_PROPERTY(float modelOffsetX READ modelOffsetX WRITE setModelOffsetX NOTIFY modelOffsetXChanged)
    Q_PROPERTY(float modelOffsetY READ modelOffsetY WRITE setModelOffsetY NOTIFY modelOffsetYChanged)

public:
    explicit NNAAvatarCanvas(QQuickItem* parent = nullptr);
    ~NNAAvatarCanvas() override;

    Renderer* createRenderer() const override;

    QString modelPath() const;
    void setModelPath(const QString& path);
    bool modelLoaded() const;

    float modelScale() const { return m_modelScale; }
    void setModelScale(float s) { if (m_modelScale != s) { m_modelScale = s; emit modelScaleChanged(); update(); } }

    float modelOffsetX() const { return m_modelOffsetX; }
    void setModelOffsetX(float x) { if (m_modelOffsetX != x) { m_modelOffsetX = x; emit modelOffsetXChanged(); update(); } }

    float modelOffsetY() const { return m_modelOffsetY; }
    void setModelOffsetY(float y) { if (m_modelOffsetY != y) { m_modelOffsetY = y; emit modelOffsetYChanged(); update(); } }

    Q_INVOKABLE void startMotion(const QString& group, int no, int priority);
    Q_INVOKABLE void onTouchAt(float x, float y);

signals:
    void modelPathChanged();
    void modelLoadedChanged();
    void modelScaleChanged();
    void modelOffsetXChanged();
    void modelOffsetYChanged();
    void modelError(const QString& error);

protected:
    void mousePressEvent(QMouseEvent* event) override;

private:
    QString m_modelPath;
    bool m_modelLoaded = false;
    float m_modelScale = 1.0f;
    float m_modelOffsetX = 0.0f;
    float m_modelOffsetY = 0.0f;

#ifdef NNA_ENABLE_LIVE2D
    friend class NNAAvatarCanvasRenderer;
    nna::graphics::Live2DRenderer* m_live2dRenderer = nullptr;
#endif
};
