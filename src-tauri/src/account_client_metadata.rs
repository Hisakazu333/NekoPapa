use reqwest::header::{HeaderMap, HeaderValue};

pub(super) fn headers(version: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        "neko-client-metadata-version",
        HeaderValue::from_static("1"),
    );
    headers.insert(
        "neko-client-platform",
        HeaderValue::from_static(std::env::consts::OS),
    );
    headers.insert("neko-client-runtime", HeaderValue::from_static("tauri"));
    headers.insert(
        "neko-client-app-id",
        HeaderValue::from_static("app.nekopapa.desktop"),
    );
    headers.insert("neko-device-type", HeaderValue::from_static("desktop"));
    if let Ok(value) = HeaderValue::from_str(version) {
        headers.insert("neko-client-version", value);
    }
    if let Some(build) = option_env!("NEKOPAPA_BUILD_NUMBER")
        .filter(|value| value.bytes().all(|byte| byte.is_ascii_digit()))
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value > 0)
    {
        headers.insert("neko-client-build", HeaderValue::from(build));
    }
    let channel =
        option_env!("NEKOPAPA_RELEASE_CHANNEL").or(cfg!(debug_assertions).then_some("dev"));
    if let Some(channel @ ("stable" | "beta" | "dev")) = channel {
        headers.insert("neko-client-channel", HeaderValue::from_static(channel));
    }
    if let Some(version) = os_version().filter(|version| version.len() <= 128) {
        if let Ok(value) = HeaderValue::from_str(&version) {
            headers.insert("neko-os-version", value);
        }
    }
    headers
}

#[cfg(target_os = "macos")]
fn os_version() -> Option<String> {
    let output = std::process::Command::new("/usr/bin/sw_vers")
        .arg("-productVersion")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let version = String::from_utf8(output.stdout).ok()?;
    let version = version.trim();
    (!version.is_empty()).then(|| version.to_owned())
}

#[cfg(not(target_os = "macos"))]
fn os_version() -> Option<String> {
    None
}
