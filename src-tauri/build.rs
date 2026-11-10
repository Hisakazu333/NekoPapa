fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        println!("cargo:rerun-if-changed=native/desktop_tools.m");
        cc::Build::new()
            .file("native/desktop_tools.m")
            .flag("-fobjc-arc")
            .compile("desktop_tools");
        for framework in ["AppKit", "CoreGraphics", "ImageIO", "Vision"] {
            println!("cargo:rustc-link-lib=framework={framework}");
        }
    }
    tauri_build::build()
}
