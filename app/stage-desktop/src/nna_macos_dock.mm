/*
 * Project: OpenNeko Engine (NNA Core)
 * Core Architecture by Nekonano-Aether
 * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
 * SPDX-License-Identifier: MIT
 */

#include "nna_macos_dock.h"

#include <QMetaObject>
#include <QQuickWindow>

#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>

@interface NNADockClickTarget : NSObject
@property(nonatomic, assign) NNAMacOSDockView *dock;
@property(nonatomic, assign) NSInteger page;
- (void)click:(id)sender;
@end

@implementation NNADockClickTarget
- (void)click:(id)sender
{
    Q_UNUSED(sender);
    if (!self.dock)
        return;
    const int requestedPage = static_cast<int>(self.page);
    QMetaObject::invokeMethod(self.dock, [dock = self.dock, requestedPage]() {
        dock->requestPage(requestedPage);
    }, Qt::QueuedConnection);
}
@end

namespace {

NSView *nativeViewForWindow(QQuickWindow *window)
{
    if (!window)
        return nil;
    return reinterpret_cast<NSView *>(window->winId());
}

NSColor *accentColor()
{
    return [NSColor colorWithCalibratedRed:0.80 green:0.26 blue:0.35 alpha:1.0];
}

NSColor *mutedColor(bool dark)
{
    return dark
        ? [NSColor colorWithCalibratedWhite:0.82 alpha:0.72]
        : [NSColor colorWithCalibratedRed:0.30 green:0.25 blue:0.23 alpha:0.82];
}

NSColor *activeBackgroundColor(bool dark)
{
    Q_UNUSED(dark);
    return [NSColor clearColor];
}

NSColor *dockGlassTint(bool dark, bool pressed)
{
    return dark
        ? [NSColor colorWithCalibratedWhite:1.0 alpha:(pressed ? 0.10 : 0.06)]
        : [NSColor colorWithCalibratedWhite:1.0 alpha:(pressed ? 0.18 : 0.12)];
}

NSColor *selectorFillColor(bool dark, bool pressed)
{
    return dark
        ? [NSColor colorWithCalibratedWhite:1.0 alpha:(pressed ? 0.14 : 0.10)]
        : [NSColor colorWithCalibratedRed:0.995 green:0.988 blue:0.982 alpha:(pressed ? 0.94 : 0.88)];
}

NSArray<id> *selectorSheenColors(bool dark, bool pressed)
{
    return dark
        ? @[
            (id)[NSColor colorWithCalibratedWhite:1.0 alpha:(pressed ? 0.18 : 0.12)].CGColor,
            (id)[NSColor colorWithCalibratedWhite:1.0 alpha:(pressed ? 0.06 : 0.03)].CGColor,
            (id)[NSColor clearColor].CGColor
        ]
        : @[
            (id)[NSColor colorWithCalibratedWhite:1.0 alpha:(pressed ? 0.34 : 0.24)].CGColor,
            (id)[NSColor colorWithCalibratedWhite:1.0 alpha:(pressed ? 0.10 : 0.06)].CGColor,
            (id)[NSColor clearColor].CGColor
        ];
}

NSRect selectorFallbackFrameForPage(NSRect bounds, NSInteger page)
{
    static constexpr CGFloat edgeX = 8.0;
    static constexpr CGFloat edgeY = 6.0;
    static constexpr CGFloat spacing = 5.0;
    static constexpr NSInteger itemCount = 6;

    const CGFloat availableWidth = MAX(1.0, bounds.size.width - edgeX * 2.0 - spacing * (itemCount - 1));
    const CGFloat itemWidth = availableWidth / itemCount;
    const NSInteger clampedPage = MAX(0, MIN(itemCount - 1, page));
    const CGFloat selectorWidth = MIN(MAX(46.0, itemWidth * 0.58), MAX(1.0, itemWidth - 8.0));
    const CGFloat selectorHeight = MIN(MAX(28.0, bounds.size.height * 0.45), MAX(1.0, bounds.size.height - edgeY * 2.0 - 10.0));
    const CGFloat selectorX = bounds.origin.x + edgeX + clampedPage * (itemWidth + spacing) + floor((itemWidth - selectorWidth) / 2.0);
    const CGFloat selectorY = bounds.origin.y + floor((bounds.size.height - selectorHeight) / 2.0) - 1.0;
    return NSMakeRect(
        selectorX,
        selectorY,
        selectorWidth,
        selectorHeight
    );
}

NSRect selectorFrameForButton(NSView *button, NSView *content, NSInteger page, bool pressed)
{
    if (!button || !content)
        return selectorFallbackFrameForPage(content ? [content bounds] : NSZeroRect, page);

    NSView *anchorView = button;
    for (NSView *subview in [button subviews]) {
        if ([subview isKindOfClass:[NSImageView class]]) {
            anchorView = subview;
            break;
        }
    }

    NSRect anchorFrame = [anchorView convertRect:[anchorView bounds] toView:content];
    NSRect buttonFrame = [button convertRect:[button bounds] toView:content];
    if (NSWidth(anchorFrame) <= 1.0 || NSHeight(anchorFrame) <= 1.0)
        return selectorFallbackFrameForPage([content bounds], page);

    const CGFloat maxWidth = MAX(1.0, NSWidth(buttonFrame) - 10.0);
    const CGFloat maxHeight = MAX(1.0, NSHeight(buttonFrame) - 10.0);
    const CGFloat width = MIN(maxWidth, MAX(44.0, NSWidth(anchorFrame) + (pressed ? 22.0 : 18.0)));
    const CGFloat height = MIN(maxHeight, MAX(28.0, NSHeight(anchorFrame) + (pressed ? 8.0 : 6.0)));
    const CGFloat x = floor(NSMidX(anchorFrame) - width / 2.0);
    const CGFloat y = floor(NSMidY(anchorFrame) - height / 2.0);
    return NSMakeRect(x, MAX(3.0, y), width, height);
}

NSRect selectorTargetFrame(NSView *content, NSArray *buttons, NSInteger currentPage, NSInteger pressedPage)
{
    if (!content)
        return NSZeroRect;
    const bool pressed = pressedPage >= 0;
    const NSInteger page = pressed ? pressedPage : currentPage;
    const NSInteger buttonCount = buttons ? static_cast<NSInteger>([buttons count]) : 0;
    const NSInteger clampedPage = MAX(0, MIN(buttonCount - 1, page));
    if (buttons && clampedPage >= 0 && clampedPage < static_cast<NSInteger>([buttons count]))
        return selectorFrameForButton(buttons[clampedPage], content, clampedPage, pressed);
    return selectorFallbackFrameForPage([content bounds], page);
}

NSImage *symbolImage(NSString *name, bool active)
{
    if (@available(macOS 11.0, *)) {
        NSImage *image = [NSImage imageWithSystemSymbolName:name accessibilityDescription:nil];
        NSImageSymbolConfiguration *config = [NSImageSymbolConfiguration
            configurationWithPointSize:(active ? 23.5 : 23.0)
            weight:(active ? NSFontWeightSemibold : NSFontWeightRegular)];
        return [image imageWithSymbolConfiguration:config];
    }
    return nil;
}

NSAttributedString *dockTitle(NSString *title, NSColor *color, bool active)
{
    NSMutableParagraphStyle *style = [[[NSMutableParagraphStyle alloc] init] autorelease];
    style.alignment = NSTextAlignmentCenter;

    NSFont *font = active
        ? [NSFont systemFontOfSize:11.5 weight:NSFontWeightSemibold]
        : [NSFont systemFontOfSize:11.5 weight:NSFontWeightMedium];
    NSDictionary *attrs = @{
        NSForegroundColorAttributeName: color,
        NSFontAttributeName: font,
        NSParagraphStyleAttributeName: style
    };
    return [[[NSAttributedString alloc] initWithString:title attributes:attrs] autorelease];
}

NSArray<NSString *> *dockTitles()
{
    return @[@"陪伴", @"对话", @"记忆", @"世界", @"Agent", @"我的"];
}

NSArray<NSString *> *dockSymbols()
{
    return @[@"pawprint", @"bubble.left", @"star", @"globe", @"bolt", @"person"];
}

NSArray<NSString *> *dockMenuItems(NSInteger page)
{
    switch (page) {
    case 0:
        return @[@"打开陪伴页", @"桌宠开关", @"模型管理", @"姿态校准"];
    case 1:
        return @[@"打开对话页", @"新对话", @"历史记录", @"语音模式"];
    case 2:
        return @[@"打开记忆页", @"记忆时间线", @"搜索记忆", @"记忆设置"];
    case 3:
        return @[@"打开世界页", @"小屋", @"世界状态", @"外出计划"];
    case 4:
        return @[@"打开 Agent", @"工具中心", @"运行日志", @"自动化任务"];
    case 5:
        return @[@"打开我的页", @"账号同步", @"设置中心", @"隐私与数据"];
    default:
        return @[@"打开"];
    }
}

NSString *dockMenuSymbol(NSInteger page, NSInteger item)
{
    if (item == 0)
        return dockSymbols()[MAX(0, MIN(static_cast<NSInteger>(dockSymbols().count) - 1, page))];

    switch (page) {
    case 0:
        return @[@"pawprint", @"power", @"cpu", @"viewfinder"][MAX(0, MIN(3, item))];
    case 1:
        return @[@"bubble.left", @"plus.bubble", @"clock", @"waveform"][MAX(0, MIN(3, item))];
    case 2:
        return @[@"star", @"timeline.selection", @"magnifyingglass", @"gearshape"][MAX(0, MIN(3, item))];
    case 3:
        return @[@"globe", @"house", @"chart.line.uptrend.xyaxis", @"figure.walk"][MAX(0, MIN(3, item))];
    case 4:
        return @[@"bolt", @"wrench.and.screwdriver", @"list.bullet.rectangle", @"sparkles"][MAX(0, MIN(3, item))];
    case 5:
        return @[@"person", @"arrow.triangle.2.circlepath", @"gearshape", @"lock.shield"][MAX(0, MIN(3, item))];
    default:
        return @"arrow.right";
    }
}

} // namespace

@interface NNADockItemView : NSControl
@property(nonatomic, assign) NNAMacOSDockView *dock;
@property(nonatomic, assign) NSInteger page;
@property(nonatomic, retain) NSString *titleText;
@property(nonatomic, retain) NSString *symbolName;
@property(nonatomic, retain) NSImageView *imageView;
@property(nonatomic, retain) NSTextField *titleLabel;
@property(nonatomic, assign) BOOL itemActive;
@property(nonatomic, assign) BOOL itemDark;
- (instancetype)initWithTitle:(NSString *)title symbol:(NSString *)symbol page:(NSInteger)page dock:(NNAMacOSDockView *)dock;
- (void)setItemActive:(BOOL)active dark:(BOOL)dark;
- (void)setPressedVisual:(BOOL)pressed;
- (void)showPullDownMenu;
- (void)menuAction:(NSMenuItem *)item;
@end

@implementation NNADockItemView
- (instancetype)initWithTitle:(NSString *)title symbol:(NSString *)symbol page:(NSInteger)page dock:(NNAMacOSDockView *)dock
{
    self = [super initWithFrame:NSZeroRect];
    if (!self)
        return nil;

    self.dock = dock;
    self.page = page;
    self.titleText = title;
    self.symbolName = symbol;
    self.wantsLayer = YES;
    self.layer.backgroundColor = [NSColor clearColor].CGColor;
    self.layer.opaque = NO;

    self.imageView = [[[NSImageView alloc] initWithFrame:NSZeroRect] autorelease];
    self.imageView.imageAlignment = NSImageAlignCenter;
    self.imageView.imageScaling = NSImageScaleProportionallyDown;
    self.imageView.wantsLayer = YES;
    [self addSubview:self.imageView];

    self.titleLabel = [[[NSTextField alloc] initWithFrame:NSZeroRect] autorelease];
    self.titleLabel.bezeled = NO;
    self.titleLabel.drawsBackground = NO;
    self.titleLabel.editable = NO;
    self.titleLabel.selectable = NO;
    self.titleLabel.alignment = NSTextAlignmentCenter;
    self.titleLabel.lineBreakMode = NSLineBreakByClipping;
    self.titleLabel.wantsLayer = YES;
    [self addSubview:self.titleLabel];

    [self setItemActive:NO dark:NO];
    return self;
}

- (void)dealloc
{
    self.titleText = nil;
    self.symbolName = nil;
    self.imageView = nil;
    self.titleLabel = nil;
    [super dealloc];
}

- (BOOL)isFlipped
{
    return YES;
}

- (void)layout
{
    [super layout];

    const NSRect bounds = self.bounds;
    const CGFloat imageSize = self.itemActive ? 24.0 : 23.0;
    const CGFloat labelHeight = 16.0;
    const CGFloat gap = 4.0;
    const CGFloat totalHeight = imageSize + gap + labelHeight;
    const CGFloat imageX = floor((NSWidth(bounds) - imageSize) / 2.0);
    const CGFloat imageY = floor(MAX(4.0, (NSHeight(bounds) - totalHeight) / 2.0));
    self.imageView.frame = NSMakeRect(imageX, imageY, imageSize, imageSize);
    self.titleLabel.frame = NSMakeRect(2.0, NSMaxY(self.imageView.frame) + gap, MAX(1.0, NSWidth(bounds) - 4.0), labelHeight);
}

- (void)setItemActive:(BOOL)active dark:(BOOL)dark
{
    _itemActive = active;
    _itemDark = dark;

    NSColor *color = active ? accentColor() : mutedColor(dark);
    self.imageView.image = symbolImage(self.symbolName, active);
    if ([self.imageView respondsToSelector:@selector(setContentTintColor:)])
        self.imageView.contentTintColor = color;
    self.titleLabel.attributedStringValue = dockTitle(self.titleText, color, active);
    self.layer.backgroundColor = [NSColor clearColor].CGColor;
    [self setNeedsLayout:YES];
}

- (void)setPressedVisual:(BOOL)pressed
{
    self.wantsLayer = YES;
    [CATransaction begin];
    [CATransaction setAnimationDuration:pressed ? 0.10 : 0.18];
    [CATransaction setAnimationTimingFunction:[CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut]];
    self.layer.opacity = pressed ? 0.88f : 1.0f;
    self.layer.transform = pressed
        ? CATransform3DMakeScale(0.965, 0.965, 1.0)
        : CATransform3DIdentity;
    [CATransaction commit];
}

- (void)showPullDownMenu
{
    NSMenu *menu = [[[NSMenu alloc] initWithTitle:self.titleText ?: @""] autorelease];
    NSArray<NSString *> *items = dockMenuItems(self.page);

    for (NSInteger i = 0; i < items.count; ++i) {
        if (i == 1)
            [menu addItem:[NSMenuItem separatorItem]];

        NSMenuItem *menuItem = [[[NSMenuItem alloc] initWithTitle:items[i]
                                                           action:@selector(menuAction:)
                                                    keyEquivalent:@""] autorelease];
        menuItem.target = self;
        menuItem.tag = i;
        if (@available(macOS 11.0, *)) {
            NSImage *image = [NSImage imageWithSystemSymbolName:dockMenuSymbol(self.page, i) accessibilityDescription:nil];
            NSImageSymbolConfiguration *config = [NSImageSymbolConfiguration configurationWithPointSize:14.0 weight:NSFontWeightMedium];
            menuItem.image = [image imageWithSymbolConfiguration:config];
        }
        [menu addItem:menuItem];
    }

    const NSRect bounds = self.bounds;
    NSPoint origin = NSMakePoint(MAX(0.0, NSMidX(bounds) - 96.0), NSMinY(bounds) - 7.0);
    [menu popUpMenuPositioningItem:nil atLocation:origin inView:self];
}

- (void)menuAction:(NSMenuItem *)item
{
    if (!self.dock)
        return;
    const int requestedPage = static_cast<int>(self.page);
    const int requestedAction = static_cast<int>(item.tag);
    QMetaObject::invokeMethod(self.dock, [dock = self.dock, requestedPage, requestedAction]() {
        dock->requestMenuAction(requestedPage, requestedAction);
    }, Qt::QueuedConnection);
}

- (void)mouseDown:(NSEvent *)event
{
    if (!self.dock)
        return;

    [self setPressedVisual:YES];

    const NSPoint startPoint = [self convertPoint:event.locationInWindow fromView:nil];
    NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:0.36];
    BOOL longPress = NO;
    BOOL clickCanceled = NO;
    BOOL mouseReleased = NO;

    while (true) {
        NSEvent *next = [self.window nextEventMatchingMask:NSEventMaskLeftMouseUp | NSEventMaskLeftMouseDragged
                                                 untilDate:deadline
                                                    inMode:NSEventTrackingRunLoopMode
                                                   dequeue:YES];
        if (!next) {
            longPress = YES;
            self.dock->setPressedPage(static_cast<int>(self.page), true);
            break;
        }

        if (next.type == NSEventTypeLeftMouseUp) {
            mouseReleased = YES;
            break;
        }

        if (next.type == NSEventTypeLeftMouseDragged) {
            const NSPoint point = [self convertPoint:next.locationInWindow fromView:nil];
            const CGFloat dx = point.x - startPoint.x;
            const CGFloat dy = point.y - startPoint.y;
            if (dx * dx + dy * dy > 144.0) {
                clickCanceled = YES;
                break;
            }
        }
    }

    if (longPress && !clickCanceled) {
        while (true) {
            NSEvent *next = [self.window nextEventMatchingMask:NSEventMaskLeftMouseUp | NSEventMaskLeftMouseDragged
                                                     untilDate:[NSDate distantFuture]
                                                        inMode:NSEventTrackingRunLoopMode
                                                       dequeue:YES];
            if (!next)
                break;
            if (next.type == NSEventTypeLeftMouseUp) {
                mouseReleased = YES;
                break;
            }
            if (next.type == NSEventTypeLeftMouseDragged) {
                const NSPoint point = [self convertPoint:next.locationInWindow fromView:nil];
                const CGFloat dx = point.x - startPoint.x;
                const CGFloat dy = point.y - startPoint.y;
                if (dx * dx + dy * dy > 196.0) {
                    clickCanceled = YES;
                    break;
                }
            }
        }
    }

    if (!clickCanceled && mouseReleased) {
        if (longPress) {
            [self showPullDownMenu];
        } else {
            const int requestedPage = static_cast<int>(self.page);
            QMetaObject::invokeMethod(self.dock, [dock = self.dock, requestedPage]() {
                dock->requestPage(requestedPage);
            }, Qt::QueuedConnection);
        }
    }

    self.dock->setPressedPage(static_cast<int>(self.page), false);
    [self setPressedVisual:NO];
}

- (void)rightMouseDown:(NSEvent *)event
{
    Q_UNUSED(event);
    if (self.dock)
        self.dock->setPressedPage(static_cast<int>(self.page), true);
    [self showPullDownMenu];
    if (self.dock)
        self.dock->setPressedPage(static_cast<int>(self.page), false);
}

- (void)resetCursorRects
{
    [self addCursorRect:self.bounds cursor:[NSCursor pointingHandCursor]];
}
@end

NNAMacOSDockView::NNAMacOSDockView(QQuickItem *parent)
    : QQuickItem(parent)
{
    setAcceptedMouseButtons(Qt::NoButton);
    setAcceptHoverEvents(false);
}

NNAMacOSDockView::~NNAMacOSDockView()
{
    destroyNativeView();
}

void NNAMacOSDockView::setCurrentPage(int page)
{
    if (m_currentPage == page)
        return;
    m_currentPage = page;
    emit currentPageChanged();
    updateNativeSelection();
}

void NNAMacOSDockView::setRadius(qreal radius)
{
    if (qFuzzyCompare(m_radius, radius))
        return;
    m_radius = radius;
    emit radiusChanged();
    updateNativeAppearance();
}

void NNAMacOSDockView::setDark(bool dark)
{
    if (m_dark == dark)
        return;
    m_dark = dark;
    emit darkChanged();
    updateNativeAppearance();
    updateNativeSelection();
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
    if (!m_completed || !m_nativeView || !window()) {
        scheduleSync();
        return;
    }

    updateNativeFrame();
}

void NNAMacOSDockView::setPressedPage(int page, bool pressed)
{
    const int nextPressedPage = pressed ? qBound(0, page, 5) : -1;
    if (m_pressedPage == nextPressedPage)
        return;
    m_pressedPage = nextPressedPage;
    updateNativeAppearance();
    updateNativeSelection();
}

void NNAMacOSDockView::componentComplete()
{
    QQuickItem::componentComplete();
    m_completed = true;
    bindWindowSignals(window());
    scheduleSync();
}

void NNAMacOSDockView::geometryChange(const QRectF &newGeometry, const QRectF &oldGeometry)
{
    QQuickItem::geometryChange(newGeometry, oldGeometry);
    scheduleSync();
}

void NNAMacOSDockView::itemChange(ItemChange change, const ItemChangeData &value)
{
    QQuickItem::itemChange(change, value);
    if (change == ItemSceneChange)
        bindWindowSignals(window());
    if (change == ItemSceneChange || change == ItemVisibleHasChanged)
        scheduleSync();
}

void NNAMacOSDockView::scheduleSync()
{
    if (m_syncQueued)
        return;

    m_syncQueued = true;
    QMetaObject::invokeMethod(this, [this]() {
        m_syncQueued = false;
        syncNativeView();
    }, Qt::QueuedConnection);
}

void NNAMacOSDockView::syncNativeView()
{
    if (!m_completed || !window() || !isVisible() || width() <= 0.0 || height() <= 0.0) {
        if (m_nativeView)
            [static_cast<NSView *>(m_nativeView) setHidden:YES];
        setNativeActive(false);
        return;
    }

    ensureNativeView();
    updateNativeAppearance();
    updateNativeFrame();
    updateNativeSelection();
}

void NNAMacOSDockView::bindWindowSignals(QQuickWindow *quickWindow)
{
    if (m_boundWindow == quickWindow)
        return;

    QObject::disconnect(m_windowWidthConnection);
    QObject::disconnect(m_windowHeightConnection);
    m_boundWindow = quickWindow;

    if (!quickWindow)
        return;

    const auto resync = [this]() {
        if (!m_completed)
            return;
        if (m_nativeView && this->window())
            updateNativeFrame();
        else
            scheduleSync();
    };
    m_windowWidthConnection = QObject::connect(quickWindow, &QQuickWindow::widthChanged, this, resync);
    m_windowHeightConnection = QObject::connect(quickWindow, &QQuickWindow::heightChanged, this, resync);
}

void NNAMacOSDockView::ensureNativeView()
{
    NSView *parent = nativeViewForWindow(window());
    if (!parent) {
        setNativeActive(false);
        return;
    }

    NSView *root = static_cast<NSView *>(m_nativeView);
    if (!root) {
        root = [[NSView alloc] initWithFrame:NSZeroRect];
        root.autoresizingMask = NSViewMinXMargin | NSViewMaxXMargin | NSViewMaxYMargin;
        root.wantsLayer = YES;
        root.layer.masksToBounds = NO;

        NSView *content = [[NSView alloc] initWithFrame:NSZeroRect];
        content.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
        content.wantsLayer = YES;

        m_contentView = content;

        NSView *effect = nil;
        if (@available(macOS 26.0, *)) {
            NSGlassEffectView *glass = [[NSGlassEffectView alloc] initWithFrame:NSZeroRect];
            glass.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
            glass.style = NSGlassEffectViewStyleClear;
            glass.tintColor = [NSColor colorWithCalibratedWhite:1.0 alpha:0.18];
            glass.wantsLayer = YES;
            effect = glass;
            [root addSubview:effect];
        } else {
            NSVisualEffectView *visual = [[NSVisualEffectView alloc] initWithFrame:NSZeroRect];
            visual.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
            visual.blendingMode = NSVisualEffectBlendingModeWithinWindow;
            visual.state = NSVisualEffectStateActive;
            visual.wantsLayer = YES;
            effect = visual;
            [root addSubview:effect];
        }
        m_effectView = effect;

        if (@available(macOS 26.0, *)) {
            if ([effect isKindOfClass:[NSGlassEffectView class]])
                [static_cast<NSGlassEffectView *>(effect) setContentView:content];
        } else {
            [effect addSubview:content];
        }

        NSView *selector = nil;
        selector = [[NSView alloc] initWithFrame:NSZeroRect];
        selector.wantsLayer = YES;
        [content addSubview:selector positioned:NSWindowBelow relativeTo:nil];
        m_selectorView = selector;

        CAGradientLayer *selectorSheen = [CAGradientLayer layer];
        selectorSheen.frame = NSZeroRect;
        selectorSheen.startPoint = CGPointMake(0.5, 0.0);
        selectorSheen.endPoint = CGPointMake(0.5, 1.0);
        selectorSheen.colors = selectorSheenColors(NO, NO);
        selectorSheen.autoresizingMask = kCALayerWidthSizable | kCALayerHeightSizable;
        [selector.layer addSublayer:selectorSheen];
        m_selectorSheenLayer = selectorSheen;

        NSStackView *stack = [[NSStackView alloc] initWithFrame:NSZeroRect];
        stack.orientation = NSUserInterfaceLayoutOrientationHorizontal;
        stack.alignment = NSLayoutAttributeCenterY;
        stack.distribution = NSStackViewDistributionFillEqually;
        stack.spacing = 5.0;
        stack.edgeInsets = NSEdgeInsetsMake(6.0, 8.0, 6.0, 8.0);
        stack.frame = [content bounds];
        stack.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
        [content addSubview:stack positioned:NSWindowAbove relativeTo:selector];
        m_stackView = stack;

        NSMutableArray *items = [[NSMutableArray alloc] init];
        NSArray<NSString *> *titles = dockTitles();
        NSArray<NSString *> *symbols = dockSymbols();

        for (NSInteger i = 0; i < titles.count; ++i) {
            NNADockItemView *item = [[NNADockItemView alloc] initWithTitle:titles[i] symbol:symbols[i] page:i dock:this];
            item.translatesAutoresizingMaskIntoConstraints = NO;
            [stack addArrangedSubview:item];
            [items addObject:item];
            [item release];
        }

        m_buttons = items;
        m_nativeView = root;
        [selector release];
        [effect release];
        [stack release];
        [content release];
    }

    if ([root superview] != parent) {
        [root removeFromSuperview];
        [parent addSubview:root positioned:NSWindowAbove relativeTo:nil];
        m_parentView = parent;
    }

    [root setHidden:NO];
    setNativeActive(true);
}

void NNAMacOSDockView::destroyNativeView()
{
    NSView *root = static_cast<NSView *>(m_nativeView);
    if (root) {
        [root removeFromSuperview];
        [root release];
    }

    NSMutableArray *buttons = static_cast<NSMutableArray *>(m_buttons);
    [buttons release];

    m_nativeView = nullptr;
    m_parentView = nullptr;
    m_effectView = nullptr;
    m_contentView = nullptr;
    m_selectorView = nullptr;
    m_selectorSheenLayer = nullptr;
    m_stackView = nullptr;
    m_buttons = nullptr;
    setNativeActive(false);
}

void NNAMacOSDockView::updateNativeFrame()
{
    NSView *root = static_cast<NSView *>(m_nativeView);
    NSView *parent = static_cast<NSView *>(m_parentView);
    if (!root || !parent)
        return;

    const QPointF topLeft = mapToScene(QPointF(0.0, 0.0));
    const QPointF bottomRight = mapToScene(QPointF(width(), height()));
    const qreal x = qMin(topLeft.x(), bottomRight.x());
    const qreal y = qMin(topLeft.y(), bottomRight.y());
    const qreal w = qAbs(bottomRight.x() - topLeft.x());
    const qreal h = qAbs(bottomRight.y() - topLeft.y());

    const NSRect bounds = [parent bounds];
    const CGFloat nativeX = bounds.origin.x + x;
    const CGFloat nativeY = [parent isFlipped]
        ? bounds.origin.y + y
        : bounds.origin.y + bounds.size.height - y - h;

    [root setFrame:NSMakeRect(round(nativeX), round(nativeY), round(w), round(h))];

    NSView *content = static_cast<NSView *>(m_contentView);
    NSView *effect = static_cast<NSView *>(m_effectView);
    NSView *stack = static_cast<NSView *>(m_stackView);
    NSView *selector = static_cast<NSView *>(m_selectorView);
    CAGradientLayer *selectorSheen = static_cast<CAGradientLayer *>(m_selectorSheenLayer);
    NSArray *buttons = static_cast<NSArray *>(m_buttons);
    [effect setFrame:[root bounds]];
    [content setFrame:[root bounds]];
    [stack setFrame:[content bounds]];
    [stack layoutSubtreeIfNeeded];
    NSRect targetFrame = selectorTargetFrame(content, buttons, m_currentPage, m_pressedPage);
    [selector setFrame:targetFrame];
    selector.layer.cornerRadius = MAX(1.0, NSHeight(targetFrame) / 2.0);
    if (selectorSheen) {
        selectorSheen.frame = selector.bounds;
        selectorSheen.cornerRadius = selector.layer.cornerRadius;
    }
    if (@available(macOS 26.0, *)) {
        if ([selector isKindOfClass:[NSGlassEffectView class]])
            [static_cast<NSGlassEffectView *>(selector) setCornerRadius:MAX(1.0, NSHeight(targetFrame) / 2.0)];
    }
}

void NNAMacOSDockView::updateNativeAppearance()
{
    NSView *root = static_cast<NSView *>(m_nativeView);
    NSView *effect = static_cast<NSView *>(m_effectView);
    NSView *selector = static_cast<NSView *>(m_selectorView);
    CAGradientLayer *selectorSheen = static_cast<CAGradientLayer *>(m_selectorSheenLayer);
    if (!root || !effect)
        return;

    root.wantsLayer = YES;
    root.layer.cornerRadius = m_radius;
    root.layer.shadowColor = [NSColor colorWithCalibratedWhite:0.0 alpha:1.0].CGColor;
    root.layer.shadowOpacity = m_dark ? 0.18f : 0.10f;
    root.layer.shadowRadius = 14.0;
    root.layer.shadowOffset = CGSizeMake(0.0, -1.0);

    effect.wantsLayer = YES;
    effect.layer.cornerRadius = m_radius;
    effect.layer.masksToBounds = YES;
    effect.layer.borderWidth = 0.9;

    if (@available(macOS 26.0, *)) {
        if ([effect isKindOfClass:[NSGlassEffectView class]]) {
            const bool pressed = m_pressedPage >= 0;
            NSGlassEffectView *glass = static_cast<NSGlassEffectView *>(effect);
            glass.style = NSGlassEffectViewStyleRegular;
            glass.cornerRadius = m_radius;
            glass.tintColor = dockGlassTint(m_dark, pressed);
            effect.layer.backgroundColor = [NSColor clearColor].CGColor;
            effect.layer.borderColor = (m_dark
                ? [NSColor colorWithCalibratedWhite:1.0 alpha:(pressed ? 0.18 : 0.12)]
                : [NSColor colorWithCalibratedWhite:1.0 alpha:(pressed ? 0.88 : 0.76)]).CGColor;
            if (selector) {
                selector.wantsLayer = YES;
                selector.layer.masksToBounds = YES;
                selector.layer.borderWidth = pressed ? 1.0 : 0.84;
                selector.layer.borderColor = (m_dark
                    ? [NSColor colorWithCalibratedWhite:1.0 alpha:0.52]
                    : [NSColor colorWithCalibratedWhite:1.0 alpha:0.96]).CGColor;
                selector.layer.shadowColor = [NSColor colorWithCalibratedWhite:0.0 alpha:1.0].CGColor;
                selector.layer.shadowOpacity = pressed ? (m_dark ? 0.16f : 0.14f) : (m_dark ? 0.12f : 0.10f);
                selector.layer.shadowRadius = pressed ? 12.0 : 9.0;
                selector.layer.shadowOffset = CGSizeMake(0.0, -1.0);
                selector.layer.backgroundColor = selectorFillColor(m_dark, pressed).CGColor;
                if (selectorSheen)
                    selectorSheen.colors = selectorSheenColors(m_dark, pressed);
            }
            return;
        }
    }

    NSVisualEffectView *visual = static_cast<NSVisualEffectView *>(effect);
    visual.material = m_dark ? NSVisualEffectMaterialHUDWindow : NSVisualEffectMaterialMenu;
    visual.appearance = [NSAppearance appearanceNamed:(m_dark ? NSAppearanceNameVibrantDark : NSAppearanceNameVibrantLight)];
    visual.blendingMode = NSVisualEffectBlendingModeWithinWindow;
    visual.state = NSVisualEffectStateActive;
    effect.layer.backgroundColor = (m_dark
        ? [NSColor colorWithCalibratedWhite:1.0 alpha:0.03]
        : [NSColor colorWithCalibratedWhite:1.0 alpha:0.18]).CGColor;
    effect.layer.borderColor = (m_dark
        ? [NSColor colorWithCalibratedWhite:1.0 alpha:0.14]
        : [NSColor colorWithCalibratedWhite:1.0 alpha:0.42]).CGColor;

    if (selector) {
        selector.layer.masksToBounds = YES;
        selector.layer.borderWidth = m_pressedPage >= 0 ? 1.0 : 0.84;
        selector.layer.backgroundColor = selectorFillColor(m_dark, m_pressedPage >= 0).CGColor;
        selector.layer.borderColor = (m_dark
            ? [NSColor colorWithCalibratedWhite:1.0 alpha:0.52]
            : [NSColor colorWithCalibratedWhite:1.0 alpha:0.96]).CGColor;
        if (selectorSheen)
            selectorSheen.colors = selectorSheenColors(m_dark, m_pressedPage >= 0);
    }
}

void NNAMacOSDockView::updateNativeSelection()
{
    NSMutableArray *buttons = static_cast<NSMutableArray *>(m_buttons);
    if (!buttons)
        return;

    for (NSInteger i = 0; i < buttons.count; ++i) {
        NNADockItemView *item = buttons[i];
        [item setItemActive:(i == m_currentPage) dark:m_dark];
    }

    NSView *content = static_cast<NSView *>(m_contentView);
    NSView *selector = static_cast<NSView *>(m_selectorView);
    CAGradientLayer *selectorSheen = static_cast<CAGradientLayer *>(m_selectorSheenLayer);
    NSView *effect = static_cast<NSView *>(m_effectView);
    NSView *stack = static_cast<NSView *>(m_stackView);
    if (!content || !selector)
        return;

    [stack layoutSubtreeIfNeeded];
    const NSRect targetFrame = selectorTargetFrame(content, buttons, m_currentPage, m_pressedPage);
    const NSRect currentFrame = [selector frame];
    const bool pressed = m_pressedPage >= 0;
    if (NSWidth(currentFrame) <= 1.0 || NSHeight(currentFrame) <= 1.0) {
        [selector setFrame:targetFrame];
        selector.layer.cornerRadius = MAX(1.0, NSHeight(targetFrame) / 2.0);
        if (selectorSheen) {
            selectorSheen.frame = selector.bounds;
            selectorSheen.cornerRadius = selector.layer.cornerRadius;
            selectorSheen.colors = selectorSheenColors(m_dark, pressed);
        }
        if (@available(macOS 26.0, *)) {
            if ([selector isKindOfClass:[NSGlassEffectView class]])
                [static_cast<NSGlassEffectView *>(selector) setCornerRadius:MAX(1.0, NSHeight(targetFrame) / 2.0)];
        }
        return;
    }

    if (@available(macOS 26.0, *)) {
        if ([effect isKindOfClass:[NSGlassEffectView class]]) {
            const bool pressed = m_pressedPage >= 0;
            NSGlassEffectView *glass = static_cast<NSGlassEffectView *>(effect);
            [NSAnimationContext runAnimationGroup:^(NSAnimationContext *context) {
                context.duration = 0.18;
                glass.tintColor = dockGlassTint(m_dark, pressed);
            } completionHandler:nil];
        }
    }

    selector.layer.cornerRadius = MAX(1.0, NSHeight(targetFrame) / 2.0);
    selector.layer.borderWidth = pressed ? 1.0 : 0.84;
    selector.layer.backgroundColor = selectorFillColor(m_dark, pressed).CGColor;
    selector.layer.borderColor = (m_dark
        ? [NSColor colorWithCalibratedWhite:1.0 alpha:0.34]
        : [NSColor colorWithCalibratedWhite:1.0 alpha:0.86]).CGColor;
    if (selectorSheen) {
        selectorSheen.frame = selector.bounds;
        selectorSheen.cornerRadius = selector.layer.cornerRadius;
        selectorSheen.colors = selectorSheenColors(m_dark, pressed);
    }
    [NSAnimationContext runAnimationGroup:^(NSAnimationContext *context) {
        context.duration = pressed ? 0.16 : 0.24;
        context.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut];
        [[selector animator] setFrame:targetFrame];
    } completionHandler:nil];
}

void NNAMacOSDockView::setNativeActive(bool active)
{
    if (m_nativeActive == active)
        return;
    m_nativeActive = active;
    emit nativeActiveChanged();
}
