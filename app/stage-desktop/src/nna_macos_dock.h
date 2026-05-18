/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#pragma once

#include <QMetaObject>
#include <QPointer>
#include <QQuickItem>

class QQuickWindow;

class NNAMacOSDockView : public QQuickItem
{
    Q_OBJECT
    Q_PROPERTY(int currentPage READ currentPage WRITE setCurrentPage NOTIFY currentPageChanged)
    Q_PROPERTY(qreal radius READ radius WRITE setRadius NOTIFY radiusChanged)
    Q_PROPERTY(bool dark READ dark WRITE setDark NOTIFY darkChanged)
    Q_PROPERTY(bool nativeActive READ nativeActive NOTIFY nativeActiveChanged)

public:
    explicit NNAMacOSDockView(QQuickItem *parent = nullptr);
    ~NNAMacOSDockView() override;

    int currentPage() const { return m_currentPage; }
    void setCurrentPage(int page);

    qreal radius() const { return m_radius; }
    void setRadius(qreal radius);

    bool dark() const { return m_dark; }
    void setDark(bool dark);

    bool nativeActive() const { return m_nativeActive; }

    Q_INVOKABLE void requestPage(int page);
    Q_INVOKABLE void requestMenuAction(int page, int action);
    Q_INVOKABLE void refreshNativeFrame();
    void setPressedPage(int page, bool pressed);

signals:
    void currentPageChanged();
    void radiusChanged();
    void darkChanged();
    void nativeActiveChanged();
    void pageRequested(int page);
    void menuActionRequested(int page, int action);

protected:
    void componentComplete() override;
    void geometryChange(const QRectF &newGeometry, const QRectF &oldGeometry) override;
    void itemChange(ItemChange change, const ItemChangeData &value) override;

private:
    void scheduleSync();
    void syncNativeView();
    void bindWindowSignals(QQuickWindow *window);
    void ensureNativeView();
    void destroyNativeView();
    void updateNativeFrame();
    void updateNativeAppearance();
    void updateNativeSelection();
    void setNativeActive(bool active);

    int m_currentPage = 0;
    int m_pressedPage = -1;
    qreal m_radius = 28.0;
    bool m_dark = false;
    bool m_nativeActive = false;
    bool m_completed = false;
    bool m_syncQueued = false;
    QPointer<QQuickWindow> m_boundWindow;
    QMetaObject::Connection m_windowWidthConnection;
    QMetaObject::Connection m_windowHeightConnection;
    void *m_nativeView = nullptr;
    void *m_parentView = nullptr;
    void *m_effectView = nullptr;
    void *m_contentView = nullptr;
    void *m_selectorView = nullptr;
    void *m_selectorSheenLayer = nullptr;
    void *m_stackView = nullptr;
    void *m_buttons = nullptr;
};
