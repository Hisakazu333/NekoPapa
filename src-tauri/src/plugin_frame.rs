//! Serves interface plugins' frame views (docs/plugin-slots.md, stage 3)
//! through the `nekopapa-plugin` scheme: `nekopapa-plugin://localhost/<id>/<path>`
//! on macOS and Linux, `http://nekopapa-plugin.localhost/<id>/<path>` on
//! Windows, plus the bridge script at `/__sdk/plugin-bridge.js`.
//!
//! Only folders the front end allowed for an enabled plugin are served, and
//! only static files inside them with a known type, no hidden path segments
//! and at most 8 MB. Every response carries a CSP that lets the page load
//! its own files and the bridge, and nothing else: no network, no frames,
//! no workers, no forms. The page itself runs in an iframe sandboxed without
//! `allow-same-origin`; it has no Tauri invoke key (Tauri injects that into
//! the main frame only) and talks to the app over a MessagePort the app
//! checks call by call. The browser preview mirrors this in
//! scripts/plugin-frame-api.ts.

use crate::plugin_manifest::read_manifest;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::http::{header, Request, Response, StatusCode};

pub const SCHEME: &str = "nekopapa-plugin";
const SDK_PATH: &str = "__sdk/plugin-bridge.js";
const SDK: &str = include_str!("plugin_bridge_sdk.js");
const MAX_FILE: u64 = 8 * 1024 * 1024;

/// Plugin id → its folder, as allowed by the front end for enabled plugins.
#[derive(Default)]
pub struct PluginFrames(Mutex<HashMap<String, PathBuf>>);

fn valid_plugin_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 100
        && id.split(['.', '-']).all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit()))
}

/// Lets `plugin_id`'s frame files be served from `folder`, after checking
/// that the folder's manifest really is that plugin's.
pub fn allow(frames: &PluginFrames, plugin_id: &str, folder: &str) -> Result<(), String> {
    if !valid_plugin_id(plugin_id) {
        return Err("插件 id 不对。".into());
    }
    let file = read_manifest(folder)?;
    let manifest: serde_json::Value = serde_json::from_str(&file.text).map_err(|_| "插件清单不是有效的 JSON。".to_string())?;
    if manifest.get("id").and_then(|id| id.as_str()) != Some(plugin_id) {
        return Err("插件文件夹里的清单不是这个插件的。".into());
    }
    frames.0.lock().map_err(|_| "插件状态不可用。".to_string())?.insert(plugin_id.to_string(), PathBuf::from(file.folder));
    Ok(())
}

pub fn revoke(frames: &PluginFrames, plugin_id: &str) {
    if let Ok(mut map) = frames.0.lock() {
        map.remove(plugin_id);
    }
}

#[tauri::command]
pub async fn plugin_frame_allow(state: tauri::State<'_, PluginFrames>, plugin_id: String, folder: String) -> Result<(), String> {
    allow(&state, &plugin_id, &folder)
}

#[tauri::command]
pub fn plugin_frame_revoke(state: tauri::State<'_, PluginFrames>, plugin_id: String) {
    revoke(&state, &plugin_id);
}

/// The CSP of every response for `plugin_id`: its own files and the bridge.
pub fn frame_csp(plugin_id: &str) -> String {
    let own = ["nekopapa-plugin://localhost", "http://nekopapa-plugin.localhost"]
        .iter()
        .map(|base| format!("{base}/{plugin_id}/ {base}/__sdk/"))
        .collect::<Vec<_>>()
        .join(" ");
    format!(
        "default-src 'none'; script-src {own}; style-src {own} 'unsafe-inline'; img-src {own} data: blob:; font-src {own}; media-src {own}; \
         connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
    )
}

pub fn content_type(path: &str) -> Option<&'static str> {
    let ext = path.rsplit_once('.')?.1.to_ascii_lowercase();
    Some(match ext.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "txt" | "md" => "text/plain; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        _ => return None,
    })
}

fn decode(segment: &str) -> Option<String> {
    let bytes = segment.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = std::str::from_utf8(bytes.get(index + 1..index + 3)?).ok()?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            index += 3;
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Splits a request path into the plugin id and the file's path segments.
/// Segments may only use letters, digits, `.`, `_` and `-`, and may not start
/// with a dot, so `..`, hidden files and encoded slashes never resolve.
pub fn split_path(path: &str) -> Option<(String, Vec<String>)> {
    let mut parts = path.trim_start_matches('/').split('/').map(decode);
    let id = parts.next()??;
    let rest = parts.collect::<Option<Vec<_>>>()?;
    let segment_ok = |s: &String| !s.is_empty() && !s.starts_with('.') && s.len() <= 120
        && s.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'));
    if !valid_plugin_id(&id) || rest.is_empty() || rest.len() > 12 || !rest.iter().all(segment_ok) {
        return None;
    }
    Some((id, rest))
}

fn reply(status: StatusCode, kind: &str, csp: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, kind)
        .header(header::CONTENT_SECURITY_POLICY, csp)
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::REFERRER_POLICY, "no-referrer")
        // Module scripts and fonts from an opaque-origin page are CORS requests.
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(body)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn not_found(csp: &str) -> Response<Vec<u8>> {
    reply(StatusCode::NOT_FOUND, "text/plain; charset=utf-8", csp, "找不到这个插件文件。".as_bytes().to_vec())
}

fn read_inside(root: &Path, segments: &[String]) -> Option<Vec<u8>> {
    let resolved = fs::canonicalize(segments.iter().fold(root.to_path_buf(), |path, part| path.join(part))).ok()?;
    if !resolved.starts_with(root) {
        return None;
    }
    let meta = fs::metadata(&resolved).ok()?;
    if !meta.is_file() || meta.len() > MAX_FILE {
        return None;
    }
    fs::read(resolved).ok()
}

/// Answers one request to the scheme.
pub fn serve(frames: &PluginFrames, path: &str, method: &str) -> Response<Vec<u8>> {
    let none = "default-src 'none'";
    if method != "GET" && method != "HEAD" {
        return reply(StatusCode::METHOD_NOT_ALLOWED, "text/plain; charset=utf-8", none, Vec::new());
    }
    if path.trim_start_matches('/') == SDK_PATH {
        return reply(StatusCode::OK, "text/javascript; charset=utf-8", none, SDK.as_bytes().to_vec());
    }
    let Some((id, segments)) = split_path(path) else { return not_found(none) };
    let csp = frame_csp(&id);
    let Some(kind) = content_type(segments.last().map(String::as_str).unwrap_or_default()) else { return not_found(&csp) };
    let root = frames.0.lock().ok().and_then(|map| map.get(&id).cloned());
    match root.and_then(|root| read_inside(&root, &segments)) {
        Some(body) => reply(StatusCode::OK, kind, &csp, body),
        None => not_found(&csp),
    }
}

/// The scheme handler registered in lib.rs.
pub fn handle<R: tauri::Runtime>(app: &tauri::AppHandle<R>, request: Request<Vec<u8>>, responder: tauri::UriSchemeResponder) {
    use tauri::Manager;
    let app = app.clone();
    let path = request.uri().path().to_string();
    let method = request.method().as_str().to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let frames = app.state::<PluginFrames>();
        responder.respond(serve(&frames, &path, &method));
    });
}

#[cfg(test)]
#[path = "plugin_frame_tests.rs"]
mod tests;
