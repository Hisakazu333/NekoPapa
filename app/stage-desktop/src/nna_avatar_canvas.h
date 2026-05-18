/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#pragma once

#include <QQuickFramebufferObject>
#include <QPointer>
#include <QTimer>
#include <QString>
#include <QtGlobal>

#ifdef NNA_ENABLE_LIVE2D
#include "nna/graphics/live2d/live2d_renderer.h"
#endif

class QQuickWindow;

class NNAAvatarCanvas : public QQuickFramebufferObject {
    Q_OBJECT
    Q_PROPERTY(QString modelPath READ modelPath WRITE setModelPath NOTIFY modelPathChanged)
    Q_PROPERTY(bool modelLoaded READ modelLoaded NOTIFY modelLoadedChanged)
    Q_PROPERTY(float modelScale READ modelScale WRITE setModelScale NOTIFY modelScaleChanged)
    Q_PROPERTY(float modelOffsetX READ modelOffsetX WRITE setModelOffsetX NOTIFY modelOffsetXChanged)
    Q_PROPERTY(float modelOffsetY READ modelOffsetY WRITE setModelOffsetY NOTIFY modelOffsetYChanged)
    Q_PROPERTY(float projectionWidthHint READ projectionWidthHint WRITE setProjectionWidthHint NOTIFY projectionWidthHintChanged)
    Q_PROPERTY(float projectionHeightHint READ projectionHeightHint WRITE setProjectionHeightHint NOTIFY projectionHeightHintChanged)

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

    float projectionWidthHint() const { return m_projectionWidthHint; }
    void setProjectionWidthHint(float value) {
        if (m_projectionWidthHint != value) {
            m_projectionWidthHint = value;
            emit projectionWidthHintChanged();
            update();
        }
    }

    float projectionHeightHint() const { return m_projectionHeightHint; }
    void setProjectionHeightHint(float value) {
        if (m_projectionHeightHint != value) {
            m_projectionHeightHint = value;
            emit projectionHeightHintChanged();
            update();
        }
    }

    Q_INVOKABLE void startMotion(const QString& group, int no, int priority);
    Q_INVOKABLE void setMouthOpen(float value);
    Q_INVOKABLE void setExpression(const QString& expressionId);
    Q_INVOKABLE void setParameterValue(const QString& parameterId, float value, float weight = 1.0f);
    Q_INVOKABLE void addParameterValue(const QString& parameterId, float value, float weight = 1.0f);
    Q_INVOKABLE void clearParameterValue(const QString& parameterId);
    Q_INVOKABLE QString modelCapabilityJson() const;
    Q_INVOKABLE void triggerLookAt(float x, float y, float strength = 1.0f, int durationMs = 1800);
    Q_INVOKABLE void startLookTracking(float x, float y, float strength = 1.0f);
    Q_INVOKABLE void updateLookTracking(float x, float y, float strength = 1.0f);
    Q_INVOKABLE void releaseLookTracking(int durationMs = 900);
    Q_INVOKABLE void onTouchAt(float x, float y);

signals:
    void modelPathChanged();
    void modelLoadedChanged();
    void modelScaleChanged();
    void modelOffsetXChanged();
    void modelOffsetYChanged();
    void projectionWidthHintChanged();
    void projectionHeightHintChanged();
    void modelError(const QString& error);

protected:
    void componentComplete() override;
    void mousePressEvent(QMouseEvent* event) override;
    void hoverEnterEvent(QHoverEvent* event) override;
    void hoverMoveEvent(QHoverEvent* event) override;
    void hoverLeaveEvent(QHoverEvent* event) override;

private:
    void refreshFrameLoop();
    void bindWindow(QQuickWindow* window);

    QString m_modelPath;
    bool m_modelLoaded = false;
    float m_modelScale = 1.0f;
    float m_modelOffsetX = 0.0f;
    float m_modelOffsetY = 0.0f;
    float m_projectionWidthHint = 0.0f;
    float m_projectionHeightHint = 0.0f;
    qint64 m_lastHoverUpdateMs = 0;
    bool m_modelLoadFailed = false;
    QTimer m_frameTimer;
    QPointer<QQuickWindow> m_boundWindow;

#ifdef NNA_ENABLE_LIVE2D
    friend class NNAAvatarCanvasRenderer;
    nna::graphics::Live2DRenderer* m_live2dRenderer = nullptr;
#endif
};
