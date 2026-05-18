/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#include "nna_macos_dock.h"

NNAMacOSDockView::NNAMacOSDockView(QQuickItem *parent)
    : QQuickItem(parent)
{
    setAcceptedMouseButtons(Qt::NoButton);
}

NNAMacOSDockView::~NNAMacOSDockView() = default;

void NNAMacOSDockView::setCurrentPage(int page)
{
    if (m_currentPage == page)
        return;
    m_currentPage = page;
    emit currentPageChanged();
}

void NNAMacOSDockView::setRadius(qreal radius)
{
    if (qFuzzyCompare(m_radius, radius))
        return;
    m_radius = radius;
    emit radiusChanged();
}

void NNAMacOSDockView::setDark(bool dark)
{
    if (m_dark == dark)
        return;
    m_dark = dark;
    emit darkChanged();
}

void NNAMacOSDockView::requestPage(int page)
{
    emit pageRequested(page);
}

void NNAMacOSDockView::requestMenuAction(int page, int action)
{
    emit menuActionRequested(page, action);
}

void NNAMacOSDockView::refreshNativeFrame()
{
    scheduleSync();
}

void NNAMacOSDockView::setPressedPage(int page, bool pressed)
{
    Q_UNUSED(page);
    Q_UNUSED(pressed);
}

void NNAMacOSDockView::componentComplete()
{
    QQuickItem::componentComplete();
    m_completed = true;
}

void NNAMacOSDockView::geometryChange(const QRectF &newGeometry, const QRectF &oldGeometry)
{
    QQuickItem::geometryChange(newGeometry, oldGeometry);
}

void NNAMacOSDockView::itemChange(ItemChange change, const ItemChangeData &value)
{
    QQuickItem::itemChange(change, value);
}

void NNAMacOSDockView::scheduleSync() {}
void NNAMacOSDockView::syncNativeView() {}
void NNAMacOSDockView::bindWindowSignals(QQuickWindow *window)
{
    Q_UNUSED(window);
}
void NNAMacOSDockView::ensureNativeView() {}
void NNAMacOSDockView::destroyNativeView() {}
void NNAMacOSDockView::updateNativeFrame() {}
void NNAMacOSDockView::updateNativeAppearance() {}
void NNAMacOSDockView::updateNativeSelection() {}

void NNAMacOSDockView::setNativeActive(bool active)
{
    if (m_nativeActive == active)
        return;
    m_nativeActive = active;
    emit nativeActiveChanged();
}
