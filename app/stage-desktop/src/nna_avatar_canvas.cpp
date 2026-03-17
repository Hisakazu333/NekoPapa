/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#include "nna_avatar_canvas.h"
#include <QMouseEvent>
#include <QOpenGLFramebufferObject>
#include <QOpenGLContext>
#include <QOpenGLFunctions>
#include <QQuickWindow>
#include <QDir>

#ifdef NNA_ENABLE_LIVE2D
#include "nna/graphics/live2d/live2d_pal.h"
#endif

// Minimal no-op renderer used when Live2D is disabled — prevents null-deref in Qt
class NNAFallbackRenderer : public QQuickFramebufferObject::Renderer {
public:
    QOpenGLFramebufferObject* createFramebufferObject(const QSize& size) override {
        return new QOpenGLFramebufferObject(size, QOpenGLFramebufferObject::CombinedDepthStencil);
    }
    void render() override {
        auto* f = QOpenGLContext::currentContext()->functions();
        f->glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
        f->glClear(GL_COLOR_BUFFER_BIT);
    }
};

#ifdef NNA_ENABLE_LIVE2D

class NNAAvatarCanvasRenderer : public QQuickFramebufferObject::Renderer {
public:
    explicit NNAAvatarCanvasRenderer(NNAAvatarCanvas* item)
        : m_item(item) {}

    QOpenGLFramebufferObject* createFramebufferObject(const QSize& size) override {
        qDebug() << "[NNAAvatarCanvas] createFBO size:" << size;
        QOpenGLFramebufferObject::Attachment attachment =
            QOpenGLFramebufferObject::CombinedDepthStencil;
        return new QOpenGLFramebufferObject(size, attachment);
    }

    void synchronize(QQuickFramebufferObject* item) override {
        auto* canvas = static_cast<NNAAvatarCanvas*>(item);
        m_width = static_cast<int>(canvas->width());
        m_height = static_cast<int>(canvas->height());
        m_scale = canvas->m_modelScale;
        m_offsetX = canvas->m_modelOffsetX;
        m_offsetY = canvas->m_modelOffsetY;

        if (canvas->m_modelPath != m_currentModelPath) {
            m_currentModelPath = canvas->m_modelPath;
            m_needsReload = true;
            qDebug() << "[NNAAvatarCanvas] sync: modelPath changed to" << m_currentModelPath;
        }
    }

    void render() override {
        if (!m_item->m_live2dRenderer || m_initFailed) return;

        // Initialize Cubism Framework on first render (needs OpenGL context)
        if (!m_frameworkReady) {
            qDebug() << "[NNAAvatarCanvas] render: initializing framework";
            if (!m_item->m_live2dRenderer->initFramework()) {
                qWarning() << "[NNAAvatarCanvas] render: framework init FAILED, disabling Live2D";
                m_initFailed = true;
                return;
            }
            m_frameworkReady = true;
        }

        // Re-check model path (QML binding may resolve after first synchronize)
        if (m_item->m_modelPath != m_currentModelPath) {
            m_currentModelPath = m_item->m_modelPath;
            m_needsReload = true;
        }

        if (m_needsReload && !m_currentModelPath.isEmpty()) {
            qDebug() << "[NNAAvatarCanvas] render: loading model from" << m_currentModelPath;
            m_needsReload = false;
            loadModel();
        }

        m_item->m_live2dRenderer->update();

        // Use FBO actual size, not logical item size
        auto* fbo = framebufferObject();
        int fboW = fbo ? fbo->width() : m_width;
        int fboH = fbo ? fbo->height() : m_height;

        if (m_debugFrames < 3) {
            qDebug() << "[NNAAvatarCanvas] render: item=" << m_width << "x" << m_height
                     << "fbo=" << fboW << "x" << fboH
                     << "scale=" << m_scale << "offX=" << m_offsetX << "offY=" << m_offsetY;
            m_debugFrames++;
        }

        glViewport(0, 0, fboW, fboH);
        glClearColor(0.0f, 0.0f, 0.0f, 0.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        if (m_item->m_live2dRenderer->isModelLoaded()) {
            m_item->m_live2dRenderer->draw(fboW, fboH, m_scale, m_offsetX, m_offsetY);
        }

        update();
    }

private:
    void loadModel() {
        QDir modelDir(m_currentModelPath);
        if (!modelDir.exists()) {
            emit m_item->modelError("Model directory not found: " + m_currentModelPath);
            return;
        }

        QStringList jsonFiles = modelDir.entryList({"*.model3.json"}, QDir::Files);
        if (jsonFiles.isEmpty()) {
            emit m_item->modelError("No .model3.json found in: " + m_currentModelPath);
            return;
        }

        QString dirPath = m_currentModelPath;
        if (!dirPath.endsWith('/')) dirPath += '/';

        nna::graphics::Live2DPal::setModelRootPath("");

        bool ok = m_item->m_live2dRenderer->loadModel(
            dirPath.toStdString(), jsonFiles.first().toStdString());

        m_item->m_modelLoaded = ok;
        emit m_item->modelLoadedChanged();

        if (!ok) {
            emit m_item->modelError("Failed to load model: " + jsonFiles.first());
        }
    }

    NNAAvatarCanvas* m_item;
    int m_width = 0;
    int m_height = 0;
    float m_scale = 1.0f;
    float m_offsetX = 0.0f;
    float m_offsetY = 0.0f;
    QString m_currentModelPath;
    bool m_needsReload = false;
    bool m_frameworkReady = false;
    bool m_initFailed = false;
    int m_debugFrames = 0;
};

#endif // NNA_ENABLE_LIVE2D

// --- NNAAvatarCanvas implementation ---

NNAAvatarCanvas::NNAAvatarCanvas(QQuickItem* parent)
    : QQuickFramebufferObject(parent)
{
    qDebug() << "[NNAAvatarCanvas] constructor";
    setAcceptedMouseButtons(Qt::LeftButton);
    setMirrorVertically(true);

#ifdef NNA_ENABLE_LIVE2D
    m_live2dRenderer = new nna::graphics::Live2DRenderer();
    qDebug() << "[NNAAvatarCanvas] Live2DRenderer created";
#endif
}

NNAAvatarCanvas::~NNAAvatarCanvas() {
    qDebug() << "[NNAAvatarCanvas] destructor called";
#ifdef NNA_ENABLE_LIVE2D
    delete m_live2dRenderer;
#endif
}

QQuickFramebufferObject::Renderer* NNAAvatarCanvas::createRenderer() const {
    qDebug() << "[NNAAvatarCanvas] createRenderer() called";
#ifdef NNA_ENABLE_LIVE2D
    auto* r = new NNAAvatarCanvasRenderer(const_cast<NNAAvatarCanvas*>(this));
    qDebug() << "[NNAAvatarCanvas] createRenderer() returning Live2D renderer";
    return r;
#else
    qDebug() << "[NNAAvatarCanvas] createRenderer() returning fallback (Live2D disabled)";
    return new NNAFallbackRenderer();
#endif
}

QString NNAAvatarCanvas::modelPath() const { return m_modelPath; }

void NNAAvatarCanvas::setModelPath(const QString& path) {
    if (m_modelPath != path) {
        m_modelPath = path;
        emit modelPathChanged();
        update();
    }
}

bool NNAAvatarCanvas::modelLoaded() const { return m_modelLoaded; }

void NNAAvatarCanvas::startMotion(const QString& group, int no, int priority) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->startMotion(group.toUtf8().constData(), no, priority);
    }
#endif
}

void NNAAvatarCanvas::onTouchAt(float x, float y) {
#ifdef NNA_ENABLE_LIVE2D
    if (m_live2dRenderer) {
        m_live2dRenderer->onTouch(x, y,
            static_cast<int>(width()), static_cast<int>(height()));
    }
#endif
}

void NNAAvatarCanvas::mousePressEvent(QMouseEvent* event) {
    onTouchAt(static_cast<float>(event->position().x()),
              static_cast<float>(event->position().y()));
    event->accept();
}
