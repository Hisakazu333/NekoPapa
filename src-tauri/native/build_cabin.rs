use std::{
    collections::hash_map::DefaultHasher,
    env,
    hash::{Hash, Hasher},
    path::PathBuf,
    process::Command,
};

pub fn build() {
    println!("cargo:rerun-if-env-changed=NEKOCORE_NANO_PATH");
    let manifest = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let sdk = env::var_os("NEKOCORE_NANO_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|| manifest.join("../../NekoCore-Nano"))
        .canonicalize()
        .expect("NekoCore-Nano is required for the macOS cabin. Set NEKOCORE_NANO_PATH.");
    for part in ["CMakeLists.txt", "src", "include", "third_party"] {
        println!("cargo:rerun-if-changed={}", sdk.join(part).display());
    }
    println!("cargo:rerun-if-changed=native");
    let out = PathBuf::from(env::var_os("OUT_DIR").unwrap());
    let mut source_key = DefaultHasher::new();
    sdk.hash(&mut source_key);
    let build = out.join(format!("nano-live2d-{:016x}", source_key.finish()));
    let arch = match env::var("CARGO_CFG_TARGET_ARCH").as_deref() {
        Ok("aarch64") => "arm64",
        Ok("x86_64") => "x86_64",
        _ => panic!("NekoCore-Nano requires macOS arm64 or x86_64"),
    };
    check(
        Command::new("cmake")
            .arg("-S")
            .arg(&sdk)
            .arg("-B")
            .arg(&build)
            .args([
                "-DCMAKE_BUILD_TYPE=Release",
                "-DNNA_BUILD_LIVE2D_LIBRARY=ON",
            ])
            .arg(format!("-DCMAKE_OSX_ARCHITECTURES={arch}")),
    );
    check(Command::new("cmake").arg("--build").arg(&build).args([
        "--target",
        "nekocore_live2d",
        "--parallel",
        "8",
    ]));
    let object = out.join("cabin_view.o");
    check(
        Command::new("xcrun")
            .args([
                "--sdk",
                "macosx",
                "clang++",
                "-arch",
                arch,
                "-fobjc-arc",
                "-std=c++20",
                "-O2",
                "-c",
            ])
            .arg(manifest.join("native/cabin_view.mm"))
            .arg("-I")
            .arg(sdk.join("include"))
            .arg("-o")
            .arg(&object),
    );
    check(
        Command::new("/usr/bin/libtool")
            .arg("-static")
            .arg("-o")
            .arg(out.join("libnekopapa_cabin_view.a"))
            .arg(object),
    );
    println!("cargo:rustc-link-search=native={}", out.display());
    println!("cargo:rustc-link-search=native={}", build.display());
    println!("cargo:rustc-link-lib=static=nekopapa_cabin_view");
    println!("cargo:rustc-link-lib=static=nekocore_live2d_macos");
    println!("cargo:rustc-link-lib=c++");
    for framework in ["AppKit", "QuartzCore", "CoreGraphics", "OpenGL"] {
        println!("cargo:rustc-link-lib=framework={framework}");
    }
}

fn check(command: &mut Command) {
    let status = command
        .status()
        .expect("could not run native Live2D build tool");
    assert!(status.success(), "native Live2D build failed: {command:?}");
}
