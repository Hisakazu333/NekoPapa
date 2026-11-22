#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#include "nna/c_api/nna_c_api.h"
#include "nna/c_api/nna_live2d_controller_c_api.h"
#include "nna/c_api/nna_live2d_mac.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <memory>
#include <mutex>

namespace {
struct FrameMailbox {
    std::mutex mutex;
    CGImageRef latest = nullptr;
    bool queued = false;
    ~FrameMailbox() { if (latest) CGImageRelease(latest); }
};
}

@interface NekoCabinView : NSView {
@public
    NnaMacSurface* surface;
    int pixelWidth;
    int pixelHeight;
    std::shared_ptr<FrameMailbox> mailbox;
}
@end

@implementation NekoCabinView
- (NSView *)hitTest:(NSPoint)point { return nil; }
@end

static CGImageRef makeImage(const unsigned char *data, int width, int height) {
    const size_t stride = static_cast<size_t>(width) * 4;
    CFMutableDataRef pixels = CFDataCreateMutable(kCFAllocatorDefault, stride * height);
    if (!pixels) return nullptr;
    CFDataSetLength(pixels, stride * height);
    auto* destination = CFDataGetMutableBytePtr(pixels);
    for (int row = 0; row < height; ++row)
        memcpy(destination + row * stride, data + (height - 1 - row) * stride, stride);
    CGDataProviderRef provider = CGDataProviderCreateWithCFData(pixels);
    CFRelease(pixels);
    if (!provider) return nullptr;
    CGColorSpaceRef colors = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    CGImageRef image = CGImageCreate(width, height, 8, 32, stride, colors,
        kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Little,
        provider, nullptr, true, kCGRenderingIntentDefault);
    CGColorSpaceRelease(colors);
    CGDataProviderRelease(provider);
    return image;
}

static void publishFrame(void* owner, const unsigned char *pixels, int width, int height) {
    @autoreleasepool {
        NekoCabinView* view = (__bridge NekoCabinView*)owner;
        auto mailbox = view->mailbox;
        CGImageRef image = makeImage(pixels, width, height);
        if (!image) return;
        {
            std::lock_guard lock(mailbox->mutex);
            if (mailbox->latest) CGImageRelease(mailbox->latest);
            mailbox->latest = image;
            if (mailbox->queued) return;
            mailbox->queued = true;
        }
        __weak NekoCabinView* weakView = view;
        dispatch_async(dispatch_get_main_queue(), ^{
            CGImageRef frame;
            {
                std::lock_guard lock(mailbox->mutex);
                frame = mailbox->latest;
                mailbox->latest = nullptr;
                mailbox->queued = false;
            }
            NekoCabinView* current = weakView;
            if (current && current->surface) {
                [CATransaction begin];
                [CATransaction setDisableActions:YES];
                current.layer.contents = (__bridge id)frame;
                [CATransaction commit];
            }
            if (frame) CGImageRelease(frame);
        });
    }
}

static void position(NekoCabinView* view, NSView* host, double x, double y,
                     double width, double height, bool visible) {
    const NSRect bounds = host.bounds;
    const auto originY = host.isFlipped ? NSMinY(bounds) + y : NSMaxY(bounds) - y - height;
    view.frame = NSMakeRect(NSMinX(bounds) + x, originY, width, height);
    view.hidden = !visible;
    // Preserve backing pixels for normal Retina windows. Limit exceptional
    // fullscreen sizes by area, rather than reducing every wide stage to 1024 px.
    constexpr double pixelBudget = 3'300'000;
    const double scale = std::min({host.window.backingScaleFactor ?: 1.0,
        std::sqrt(pixelBudget / (width * height)), 4096.0 / width, 4096.0 / height});
    view.layer.contentsScale = scale;
    const int w = std::max(1, static_cast<int>(std::round(width * scale)));
    const int h = std::max(1, static_cast<int>(std::round(height * scale)));
    if (view->pixelWidth != w || view->pixelHeight != h) {
        view->pixelWidth = w;
        view->pixelHeight = h;
        nna_mac_surface_resize(view->surface, w, h);
        if (view.superview) nna_live2d_on_surface_changed(view->surface, w, h);
    }
    nna_live2d_set_render_paused(!visible);
}

extern "C" void neko_cabin_apply_exclusions(void* handle, const double* rects, size_t count) {
    NekoCabinView* view = (__bridge NekoCabinView*)handle;
    if (!count) {
        view.layer.mask = nil;
        return;
    }
    CALayer* stage = view.layer;
    const CGRect bounds = stage.bounds;
    CGMutablePathRef path = CGPathCreateMutable();
    CGPathAddRect(path, nullptr, bounds);
    for (size_t i = 0; i < count; ++i) {
        const double* rect = rects + i * 4;
        const auto y = stage.geometryFlipped ? rect[1] : CGRectGetHeight(bounds) - rect[1] - rect[3];
        const CGRect crop = CGRectIntersection(bounds, CGRectMake(rect[0], y, rect[2], rect[3]));
        if (!CGRectIsEmpty(crop)) CGPathAddRect(path, nullptr, crop);
    }
    CAShapeLayer* mask = [CAShapeLayer layer];
    mask.frame = bounds;
    mask.fillRule = kCAFillRuleEvenOdd;
    mask.path = path;
    CGPathRelease(path);
    stage.mask = mask;
}

extern "C" void* neko_cabin_create(void* webview, const char* root, const char* model,
                                   double x, double y, double w, double h, int reduced, int visible) {
    NSView* host = (__bridge NSView*)webview;
    if (!host.window) return nullptr;
    NekoCabinView* view = [[NekoCabinView alloc] initWithFrame:NSZeroRect];
    view.wantsLayer = YES;
    view.layer.opaque = NO;
    view.layer.masksToBounds = YES;
    view->mailbox = std::make_shared<FrameMailbox>();
    view->surface = nna_mac_surface_create(publishFrame, (__bridge void*)view);
    if (!view->surface) return nullptr;
    nna_live2d_set_sandbox_path(root);
    nna_mac_configure(reduced);
    nna_live2d_set_model_definition("./", model);
    position(view, host, x, y, w, h, visible != 0);
    [host addSubview:view positioned:NSWindowAbove relativeTo:nil];
    nna_live2d_on_surface_created(view->surface, view->pixelWidth, view->pixelHeight);
    return (__bridge_retained void*)view;
}

extern "C" void neko_cabin_layout(void* handle, double x, double y, double w, double h, int visible) {
    NekoCabinView* view = (__bridge NekoCabinView*)handle;
    if (view.superview) position(view, view.superview, x, y, w, h, visible);
}

extern "C" void neko_cabin_destroy(void* handle) {
    NekoCabinView* view = (__bridge_transfer NekoCabinView*)handle;
    [view removeFromSuperview];
    nna_live2d_on_surface_destroyed(view->surface);
    // Join the renderer before freeing the opaque surface or its callback owner.
    nna_live2d_release();
    nna_mac_surface_destroy(view->surface);
    view->surface = nullptr;
    nna_live2d_set_sandbox_path("");
}

extern "C" int neko_cabin_tap(void* handle, float x, float y) {
    NekoCabinView* view = (__bridge NekoCabinView*)handle;
    return !view.hidden && nna_mac_tap(x, y, static_cast<float>(view->pixelWidth) / view->pixelHeight);
}
