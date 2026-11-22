#[cfg(target_os = "macos")]
#[path = "native/build_cabin.rs"]
mod build_cabin;

fn main() {
    #[cfg(target_os = "macos")]
    build_cabin::build();
    tauri_build::build()
}
