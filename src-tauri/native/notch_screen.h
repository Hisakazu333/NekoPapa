#import <AppKit/AppKit.h>

// The island and the capture reveal always start on the same screen, in AppKit points.
static inline NSScreen *neko_notch_screen(void) {
    if (@available(macOS 12.0, *)) {
        for (NSScreen *screen in [NSScreen screens]) {
            if (screen.safeAreaInsets.top > 0) return screen;
        }
    }
    return [NSScreen screens].firstObject;
}

static inline CGFloat neko_notch_top(NSScreen *screen) {
    CGFloat inset = 0;
    if (@available(macOS 12.0, *)) inset = screen.safeAreaInsets.top;
    return MIN(NSMaxY(screen.visibleFrame), NSMaxY(screen.frame) - inset);
}
