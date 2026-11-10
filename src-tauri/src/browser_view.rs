//! The chat window's built-in browser: one native child webview ("browser")
//! laid over the browser area the frontend reserves, plus pop-out windows.
//! Websites refuse to load inside an iframe, so pages get a real webview.
//!
//! Only http(s) pages load. The webview has no IPC: capabilities apply to the
//! app's own local content unless a capability lists remote URLs, and none
//! does. The frontend learns about navigation from the `browser://state`
//! event sent to the main webview.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Rect, Runtime, Url, Webview,
    WebviewBuilder, WebviewUrl, WebviewWindowBuilder,
};

const LABEL: &str = "browser";
const MAIN: &str = "main";
const STATE_EVENT: &str = "browser://state";

/// Browser area in CSS pixels, relative to the main webview's top-left corner.
#[derive(Deserialize, Debug, Clone, Copy)]
pub struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Serialize, Clone, Debug, Default)]
struct BrowserState {
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    loading: Option<bool>,
}

/// Accepts absolute http(s) URLs only; the frontend turns typed addresses into these.
pub fn parse_web_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw.trim()).map_err(|_| "网址格式不正确。".to_string())?;
    match url.scheme() {
        "http" | "https" if url.host_str().is_some() => Ok(url),
        _ => Err("只能打开 http 或 https 网页。".to_string()),
    }
}

fn is_web(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
}

fn rect(bounds: Bounds) -> Rect {
    Rect {
        position: LogicalPosition::new(bounds.x.max(0.0), bounds.y.max(0.0)).into(),
        size: LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)).into(),
    }
}

fn emit<R: Runtime>(app: &AppHandle<R>, state: BrowserState) {
    let _ = app.emit_to(MAIN, STATE_EVENT, state);
}

fn browser<R: Runtime>(app: &AppHandle<R>) -> Option<Webview<R>> {
    app.get_webview(LABEL)
}

fn builder<R: Runtime>(app: &AppHandle<R>, url: Url) -> WebviewBuilder<R> {
    let (load_app, title_app, window_app) = (app.clone(), app.clone(), app.clone());
    WebviewBuilder::new(LABEL, WebviewUrl::External(url))
        // Links that would leave the web (file:, app schemes) are refused.
        .on_navigation(is_web)
        // target=_blank and window.open open in this same view, not a new window.
        .on_new_window(move |url, _| {
            if let (true, Some(view)) = (is_web(&url), browser(&window_app)) {
                let _ = view.navigate(url);
            }
            NewWindowResponse::Deny
        })
        .on_page_load(move |view, payload| {
            if view.label() == LABEL {
                let loading = matches!(payload.event(), PageLoadEvent::Started);
                emit(&load_app, BrowserState { url: Some(payload.url().to_string()), title: None, loading: Some(loading) });
            }
        })
        .on_document_title_changed(move |_, title| {
            emit(&title_app, BrowserState { title: Some(title), ..Default::default() });
        })
}

/// Opens `url` in the browser area, creating the webview on first use.
#[tauri::command]
pub async fn browser_open<R: Runtime>(app: AppHandle<R>, url: String, bounds: Bounds) -> Result<(), String> {
    let url = parse_web_url(&url)?;
    if let Some(view) = browser(&app) {
        view.set_bounds(rect(bounds)).map_err(|e| e.to_string())?;
        view.show().map_err(|e| e.to_string())?;
        return view.navigate(url).map_err(|e| e.to_string());
    }
    let window = app.get_window(MAIN).ok_or("找不到主窗口。")?;
    let area = rect(bounds);
    window.add_child(builder(&app, url), area.position, area.size).map_err(|e| e.to_string())?;
    Ok(())
}

/// Follows the browser area as the panel resizes or the window moves.
#[tauri::command]
pub async fn browser_set_bounds<R: Runtime>(app: AppHandle<R>, bounds: Bounds) -> Result<(), String> {
    match browser(&app) {
        Some(view) => view.set_bounds(rect(bounds)).map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

/// Hidden while the browser area is off screen or an app menu or dialog
/// would otherwise sit underneath the native view.
#[tauri::command]
pub async fn browser_set_visible<R: Runtime>(app: AppHandle<R>, visible: bool) -> Result<(), String> {
    match browser(&app) {
        Some(view) if visible => view.show().map_err(|e| e.to_string()),
        Some(view) => view.hide().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

/// back / forward / reload / stop for the open page.
#[tauri::command]
pub async fn browser_command<R: Runtime>(app: AppHandle<R>, command: String) -> Result<(), String> {
    let view = browser(&app).ok_or("浏览器还没有打开网页。")?;
    match command.as_str() {
        "back" => view.eval("history.back()"),
        "forward" => view.eval("history.forward()"),
        "reload" => view.reload(),
        "stop" => view.eval("window.stop()"),
        _ => return Err("不支持的浏览器操作。".to_string()),
    }
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_close<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    match browser(&app) {
        Some(view) => view.close().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

static POP_OUT: AtomicU32 = AtomicU32::new(1);

/// Opens `url` in its own window, for reading a page at full size.
#[tauri::command]
pub async fn browser_open_window<R: Runtime>(app: AppHandle<R>, url: String) -> Result<(), String> {
    let url = parse_web_url(&url)?;
    let label = format!("browser-window-{}", POP_OUT.fetch_add(1, Ordering::Relaxed));
    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url))
        .title("NekoPapa 浏览器")
        .inner_size(1100.0, 760.0)
        .min_inner_size(480.0, 360.0)
        .on_navigation(is_web)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::parse_web_url;

    #[test]
    fn accepts_http_and_https_pages() {
        assert_eq!(parse_web_url("https://example.com/a?b=1").unwrap().as_str(), "https://example.com/a?b=1");
        assert_eq!(parse_web_url(" http://localhost:5173/ ").unwrap().as_str(), "http://localhost:5173/");
    }

    #[test]
    fn refuses_other_schemes_and_malformed_input() {
        for raw in ["file:///etc/passwd", "javascript:alert(1)", "tauri://localhost", "data:text/html,hi", "example.com", "https://"] {
            assert!(parse_web_url(raw).is_err(), "{raw} should be refused");
        }
    }
}
