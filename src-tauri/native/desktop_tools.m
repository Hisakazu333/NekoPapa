#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>
#import <Vision/Vision.h>
#include <string.h>
#import "notch_screen.h"

bool neko_can_capture(bool request) {
    if (@available(macOS 10.15, *)) {
        return CGPreflightScreenCaptureAccess() || (request && CGRequestScreenCaptureAccess());
    }
    return true;
}

// Returns owned UTF-8. Rust releases it after copying.
char *neko_recognize_text(const char *file) {
    @autoreleasepool {
        if (@available(macOS 10.15, *)) {
            NSURL *url = [NSURL fileURLWithPath:[NSString stringWithUTF8String:file]];
            VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] init];
            request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
            if (@available(macOS 13.0, *)) {
                request.automaticallyDetectsLanguage = YES;
            } else if (@available(macOS 12.0, *)) {
                NSArray *supported = [request supportedRecognitionLanguagesAndReturnError:nil];
                if ([supported containsObject:@"zh-Hans"]) request.recognitionLanguages = @[@"en-US", @"zh-Hans"];
            }
            request.usesLanguageCorrection = NO;
            VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithURL:url options:@{}];
            if (![handler performRequests:@[request] error:nil]) return NULL;
            NSMutableArray<NSString *> *lines = [NSMutableArray array];
            for (VNRecognizedTextObservation *observation in request.results) {
                VNRecognizedText *candidate = [[observation topCandidates:1] firstObject];
                if (candidate.string.length) [lines addObject:candidate.string];
            }
            return strdup([[lines componentsJoinedByString:@"\n"] UTF8String]);
        }
        return NULL;
    }
}

void neko_free_text(char *text) {
    free(text);
}

// Send a bounded preview to the island. The original capture stays in its temporary directory.
char *neko_capture_preview(const char *file) {
    @autoreleasepool {
        NSURL *url = [NSURL fileURLWithPath:[NSString stringWithUTF8String:file]];
        CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL);
        if (!source) return NULL;
        NSDictionary *options = @{
            (__bridge NSString *)kCGImageSourceCreateThumbnailFromImageAlways: @YES,
            (__bridge NSString *)kCGImageSourceCreateThumbnailWithTransform: @YES,
            (__bridge NSString *)kCGImageSourceThumbnailMaxPixelSize: @1000
        };
        CGImageRef preview = CGImageSourceCreateThumbnailAtIndex(source, 0, (__bridge CFDictionaryRef)options);
        CFRelease(source);
        if (!preview) return NULL;
        NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithCGImage:preview];
        CGImageRelease(preview);
        NSData *jpeg = [bitmap representationUsingType:NSBitmapImageFileTypeJPEG
                                            properties:@{NSImageCompressionFactor: @0.85}];
        if (!jpeg.length) return NULL;
        return strdup([[jpeg base64EncodedStringWithOptions:0] UTF8String]);
    }
}

void neko_position_island(void *handle, double width, double height) {
    @autoreleasepool {
        NSWindow *window = (__bridge NSWindow *)handle;
        NSScreen *screen = neko_notch_screen();
        if (!screen) return;
        NSRect frame = screen.frame;
        CGFloat top = neko_notch_top(screen);
        [window setFrame:NSMakeRect(NSMidX(frame) - width / 2, top - height, width, height) display:YES];
    }
}

void neko_position_pet(void *handle) {
    @autoreleasepool {
        NSWindow *window = (__bridge NSWindow *)handle;
        NSScreen *screen = [NSScreen screens].firstObject;
        if (!screen) return;
        NSRect frame = screen.visibleFrame;
        NSSize size = window.frame.size;
        [window setFrameOrigin:NSMakePoint(NSMaxX(frame) - size.width - 20, NSMinY(frame) + 24)];
    }
}
