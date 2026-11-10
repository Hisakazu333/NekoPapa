#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#import "notch_screen.h"

static const CFTimeInterval RevealDuration = 0.62;

void neko_animate_screen_capture(bool dark, void (*complete)(void *), void *context) {
    @autoreleasepool {
        NSScreen *screen = neko_notch_screen();
        if (!screen) {
            complete(context);
            return;
        }
        NSRect frame = screen.frame;
        NSPanel *panel = [[NSPanel alloc] initWithContentRect:frame
                                                   styleMask:NSWindowStyleMaskBorderless | NSWindowStyleMaskNonactivatingPanel
                                                     backing:NSBackingStoreBuffered defer:NO];
        panel.releasedWhenClosed = NO;
        panel.opaque = NO;
        panel.backgroundColor = NSColor.clearColor;
        panel.hasShadow = NO;
        panel.ignoresMouseEvents = YES;
        panel.level = NSStatusWindowLevel + 1;
        panel.collectionBehavior = NSWindowCollectionBehaviorCanJoinAllSpaces
                                 | NSWindowCollectionBehaviorFullScreenAuxiliary
                                 | NSWindowCollectionBehaviorStationary
                                 | NSWindowCollectionBehaviorIgnoresCycle;
        [panel setFrame:frame display:NO];

        NSView *view = panel.contentView;
        view.wantsLayer = YES;
        CALayer *surface = view.layer;
        surface.masksToBounds = YES;
        CGFloat top = NSMaxY(frame) - neko_notch_top(screen);
        CGFloat originY = surface.geometryFlipped ? top : NSHeight(frame) - top;
        CGFloat radius = hypot(NSWidth(frame) / 2, MAX(top, NSHeight(frame) - top)) + 50;

        // Feathered edge, like the theme reveal. A restrained tint lets the
        // user keep reading the original screen before the selection crosshair.
        CAGradientLayer *wave = [CAGradientLayer layer];
        wave.type = kCAGradientLayerRadial;
        wave.bounds = CGRectMake(0, 0, radius * 2, radius * 2);
        wave.position = CGPointMake(NSWidth(frame) / 2, originY);
        wave.startPoint = CGPointMake(0.5, 0.5);
        wave.endPoint = CGPointMake(1, 0.5);
        NSColor *surfaceTint = dark ? NSColor.whiteColor : NSColor.blackColor;
        NSColor *accent = NSColor.selectedControlColor;
        if (@available(macOS 10.14, *)) accent = NSColor.controlAccentColor;
        wave.colors = @[
            (__bridge id)[surfaceTint colorWithAlphaComponent:0.16].CGColor,
            (__bridge id)[surfaceTint colorWithAlphaComponent:0.14].CGColor,
            (__bridge id)[accent colorWithAlphaComponent:0.44].CGColor,
            (__bridge id)[accent colorWithAlphaComponent:0.0].CGColor
        ];
        wave.locations = @[@0.0, @0.80, @0.96, @1.0];
        wave.opacity = 0;
        [surface addSublayer:wave];

        CABasicAnimation *reveal = [CABasicAnimation animationWithKeyPath:@"transform.scale"];
        reveal.fromValue = @0.015;
        reveal.toValue = @1.0;
        reveal.duration = RevealDuration;
        reveal.timingFunction = [CAMediaTimingFunction functionWithControlPoints:0.16 :1.0 :0.3 :1.0];
        CAKeyframeAnimation *fade = [CAKeyframeAnimation animationWithKeyPath:@"opacity"];
        fade.values = @[@0.0, @1.0, @1.0, @0.0];
        fade.keyTimes = @[@0.0, @0.10, @0.65, @1.0];
        fade.duration = RevealDuration;
        CAAnimationGroup *group = [CAAnimationGroup animation];
        group.animations = @[reveal, fade];
        group.duration = RevealDuration;

        [CATransaction begin];
        [CATransaction setCompletionBlock:^{
            // Remove the overlay before invoking the system's selection UI.
            [panel orderOut:nil];
            [panel close];
            dispatch_async(dispatch_get_main_queue(), ^{ complete(context); });
        }];
        [panel orderFrontRegardless];
        [wave addAnimation:group forKey:@"capture-reveal"];
        [CATransaction commit];
    }
}
