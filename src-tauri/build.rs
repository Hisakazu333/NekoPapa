fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        for source in [
            "desktop_tools.m",
            "screen_capture_motion.m",
            "screen_island_handle.m",
            "notch_screen.h",
        ] {
            println!("cargo:rerun-if-changed=native/{source}");
        }
        cc::Build::new()
            .files([
                "native/desktop_tools.m",
                "native/screen_capture_motion.m",
                "native/screen_island_handle.m",
            ])
            .flag("-fobjc-arc")
            .compile("desktop_tools");
        for framework in ["AppKit", "CoreGraphics", "ImageIO", "QuartzCore", "Vision"] {
            println!("cargo:rustc-link-lib=framework={framework}");
        }
    }
    tauri_build::build()
}
