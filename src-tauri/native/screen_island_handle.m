#import <AppKit/AppKit.h>
#import <objc/runtime.h>
#import "notch_screen.h"

typedef void (*NekoIslandCallback)(void *);

static const NSTimeInterval HoverDelay = 0.55;
static const NSTimeInterval HoverPoll = 0.08;
static const CGFloat HandleWidth = 164;
static const CGFloat HandleHeight = 34;

@interface NekoCaptureGrip : NSView
@property (nonatomic) NSPoint origin;
@property (nonatomic) BOOL dragging;
@property (nonatomic) BOOL armed;
@property (nonatomic, copy) void (^onPull)(void);
@end

@implementation NekoCaptureGrip
- (BOOL)acceptsFirstMouse:(NSEvent *)event { return YES; }
- (BOOL)mouseDownCanMoveWindow { return NO; }

- (void)resetCursorRects {
    [self addCursorRect:self.bounds cursor:self.dragging ? NSCursor.closedHandCursor : NSCursor.openHandCursor];
}

- (void)drawRect:(NSRect)dirtyRect {
    [super drawRect:dirtyRect];
    NSBezierPath *surface = [NSBezierPath bezierPathWithRoundedRect:NSInsetRect(self.bounds, 0.5, 0.5)
                                                           xRadius:12 yRadius:12];
    NSColor *selection = NSColor.alternateSelectedControlColor;
    NSColor *border = NSColor.gridColor;
    if (@available(macOS 10.14, *)) {
        selection = NSColor.selectedContentBackgroundColor;
        border = NSColor.separatorColor;
    }
    [(self.armed ? selection : NSColor.windowBackgroundColor) setFill];
    [surface fill];
    [border setStroke];
    [surface stroke];

    NSColor *ink = self.armed ? NSColor.alternateSelectedControlTextColor : NSColor.labelColor;
    [ink setStroke];
    NSBezierPath *chevron = [NSBezierPath bezierPath];
    chevron.lineWidth = 1.5;
    chevron.lineCapStyle = NSLineCapStyleRound;
    chevron.lineJoinStyle = NSLineJoinStyleRound;
    [chevron moveToPoint:NSMakePoint(42, 19)];
    [chevron lineToPoint:NSMakePoint(46, 15)];
    [chevron lineToPoint:NSMakePoint(50, 19)];
    [chevron stroke];
    [@"下拉取材" drawAtPoint:NSMakePoint(57, 9) withAttributes:@{
        NSFontAttributeName: [NSFont systemFontOfSize:13 weight:NSFontWeightMedium],
        NSForegroundColorAttributeName: ink
    }];
}

- (BOOL)reachesThreshold:(NSEvent *)event {
    NSPoint point = [self.window convertPointToScreen:event.locationInWindow];
    CGFloat down = self.origin.y - point.y;
    return down >= 14 && down >= fabs(point.x - self.origin.x) * 0.65;
}

- (void)mouseDown:(NSEvent *)event {
    self.origin = [self.window convertPointToScreen:event.locationInWindow];
    self.dragging = YES;
    [NSCursor.closedHandCursor set];
}

- (void)mouseDragged:(NSEvent *)event {
    if (!self.dragging) return;
    BOOL armed = [self reachesThreshold:event];
    if (self.armed != armed) {
        self.armed = armed;
        self.needsDisplay = YES;
    }
}

- (void)mouseUp:(NSEvent *)event {
    if (!self.dragging) return;
    BOOL pull = [self reachesThreshold:event];
    self.dragging = NO;
    self.armed = NO;
    self.needsDisplay = YES;
    if (pull) {
        if (self.onPull) self.onPull();
    } else {
        [NSCursor.openHandCursor set];
    }
}
@end

@interface NekoCaptureHover : NSObject
@property (nonatomic, strong) NSPanel *panel;
@property (nonatomic, strong) NekoCaptureGrip *grip;
@property (nonatomic, strong) NSTimer *timer;
@property (nonatomic, strong) id closeObserver;
@property (nonatomic) NSTimeInterval enteredAt;
@property (nonatomic) BOOL waitForExit;
@property (nonatomic) NekoIslandCallback pulled;
@property (nonatomic) NekoIslandCallback releaseContext;
@property (nonatomic) void *context;
- (void)startForWindow:(NSWindow *)window;
- (void)stop;
@end

@implementation NekoCaptureHover
- (void)makePanel {
    NSRect bounds = NSMakeRect(0, 0, HandleWidth, HandleHeight);
    NSPanel *panel = [[NSPanel alloc] initWithContentRect:bounds
                                               styleMask:NSWindowStyleMaskBorderless | NSWindowStyleMaskNonactivatingPanel
                                                 backing:NSBackingStoreBuffered defer:YES];
    panel.releasedWhenClosed = NO;
    panel.hidesOnDeactivate = NO;
    panel.movable = NO;
    panel.opaque = NO;
    panel.backgroundColor = NSColor.clearColor;
    panel.hasShadow = YES;
    panel.level = NSStatusWindowLevel + 1;
    panel.collectionBehavior = NSWindowCollectionBehaviorCanJoinAllSpaces
                             | NSWindowCollectionBehaviorFullScreenAuxiliary
                             | NSWindowCollectionBehaviorStationary
                             | NSWindowCollectionBehaviorIgnoresCycle;

    NekoCaptureGrip *grip = [[NekoCaptureGrip alloc] initWithFrame:bounds];
    [grip setAccessibilityElement:YES];
    [grip setAccessibilityRole:NSAccessibilityHandleRole];
    [grip setAccessibilityLabel:@"下拉取材"];
    [grip setAccessibilityHelp:@"按住向下拖动，松开后框选屏幕。"];
    __weak NekoCaptureHover *weakSelf = self;
    grip.onPull = ^{
        NekoCaptureHover *owner = weakSelf;
        if (!owner) return;
        // Take the grip off screen before the reveal and the system selector.
        [owner stop];
        if (owner.pulled) owner.pulled(owner.context);
    };
    panel.contentView = grip;
    self.grip = grip;
    self.panel = panel;
}

- (void)poll {
    if (self.grip.dragging) return;
    NSScreen *screen = neko_notch_screen();
    if (!screen) {
        self.enteredAt = 0;
        [self.panel orderOut:nil];
        return;
    }
    CGFloat x = NSMidX(screen.frame);
    CGFloat y = neko_notch_top(screen);
    NSPoint pointer = NSEvent.mouseLocation;
    BOOL nearNotch = fabs(pointer.x - x) <= 134 &&
                     pointer.y >= y - 48 && pointer.y <= NSMaxY(screen.frame);
    if (!nearNotch) {
        self.enteredAt = 0;
        self.waitForExit = NO;
        if (self.panel.isVisible) [self.panel orderOut:nil];
        return;
    }
    if (self.waitForExit || NSEvent.pressedMouseButtons) {
        self.enteredAt = 0;
        return;
    }
    NSTimeInterval now = NSProcessInfo.processInfo.systemUptime;
    if (!self.enteredAt) self.enteredAt = now;
    if (now - self.enteredAt < HoverDelay) return;
    if (!self.panel) [self makePanel];
    NSRect frame = NSMakeRect(x - HandleWidth / 2, y - HandleHeight - 2, HandleWidth, HandleHeight);
    if (!NSEqualRects(self.panel.frame, frame)) [self.panel setFrame:frame display:YES];
    if (!self.panel.isVisible) [self.panel orderFrontRegardless];
}

- (void)startForWindow:(NSWindow *)window {
    // Sample only the pointer position in memory. No event tap, and no hit
    // surface until the user has actually hovered near the notch.
    __weak NekoCaptureHover *weakSelf = self;
    self.timer = [NSTimer timerWithTimeInterval:HoverPoll repeats:YES block:^(NSTimer *timer) {
        (void)timer;
        [weakSelf poll];
    }];
    [NSRunLoop.mainRunLoop addTimer:self.timer forMode:NSRunLoopCommonModes];
    self.closeObserver = [NSNotificationCenter.defaultCenter
        addObserverForName:NSWindowWillCloseNotification object:window queue:nil
        usingBlock:^(NSNotification *note) {
            (void)note;
            [weakSelf stop];
        }];
}

- (void)stop {
    [self.timer invalidate];
    self.timer = nil;
    if (self.closeObserver) {
        [NSNotificationCenter.defaultCenter removeObserver:self.closeObserver];
        self.closeObserver = nil;
    }
    [self.panel orderOut:nil];
    [self.panel close];
    self.panel = nil;
    self.grip = nil;
}

- (void)dealloc {
    [self stop];
    if (self.releaseContext) self.releaseContext(self.context);
}
@end

static char CaptureHandleKey;

void neko_install_island_handle(void *handle, bool idle, NekoIslandCallback pulled,
                                NekoIslandCallback releaseContext, void *context) {
    NSWindow *window = (__bridge NSWindow *)handle;
    NekoCaptureHover *old = objc_getAssociatedObject(window, &CaptureHandleKey);
    BOOL waitForExit = old && !old.timer;
    [old stop];
    objc_setAssociatedObject(window, &CaptureHandleKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    window.backgroundColor = NSColor.clearColor;
    if (!idle) {
        if (releaseContext) releaseContext(context);
        return;
    }
    NekoCaptureHover *hover = [NekoCaptureHover new];
    hover.pulled = pulled;
    hover.releaseContext = releaseContext;
    hover.context = context;
    // If the selector was cancelled near the notch, leave once before a new hover.
    hover.waitForExit = waitForExit;
    [hover startForWindow:window];
    objc_setAssociatedObject(window, &CaptureHandleKey, hover, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}
