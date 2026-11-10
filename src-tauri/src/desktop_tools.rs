use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime, Webview, WebviewUrl, WebviewWindowBuilder};

pub const ISLAND: &str = "screen-island";
pub const PET: &str = "desktop-pet";

pub fn allowed<R: Runtime>(view: &Webview<R>, labels: &[&str]) -> Result<(), String> {
    let local = view.url().is_ok_and(|url| {
        let origin = url.origin().ascii_serialization();
        (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
            || matches!(
                origin.as_str(),
                "http://tauri.localhost" | "https://tauri.localhost"
            )
            || (cfg!(debug_assertions)
                && url.scheme() == "http"
                && url.host_str() == Some("127.0.0.1")
                && matches!(url.port(), Some(1420 | 1495)))
    });
    if local && labels.contains(&view.label()) {
        Ok(())
    } else {
        Err("当前窗口不能使用此桌面功能。".into())
    }
}

pub fn data_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("DesktopTools"))
        .map_err(|_| "无法定位 NekoPapa 数据目录。".into())
}

#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn neko_position_island(window: *mut std::ffi::c_void, width: f64, height: f64);
}

#[cfg(target_os = "macos")]
async fn position<R: Runtime>(
    app: &AppHandle<R>,
    expanded: bool,
    show: bool,
) -> Result<(), String> {
    let window = app.get_webview_window(ISLAND).ok_or("灵动岛窗口已关闭。")?;
    let for_ui = window.clone();
    let (sender, mut receiver) = tauri::async_runtime::channel(1);
    window
        .run_on_main_thread(move || {
            let result = for_ui
                .ns_window()
                .map_err(|_| "无法定位灵动岛窗口。")
                .and_then(|handle| {
                    let (width, height) = if expanded {
                        (442.0, 620.0)
                    } else {
                        (174.0, 38.0)
                    };
                    // AppKit takes screen points, so mixed Retina displays do not skew the anchor.
                    unsafe { neko_position_island(handle, width, height) };
                    if show {
                        for_ui.show().map_err(|_| "无法显示灵动岛。")?;
                    }
                    Ok(())
                });
            let _ = sender.try_send(result);
        })
        .map_err(|_| "无法定位灵动岛窗口。")?;
    receiver
        .recv()
        .await
        .ok_or("灵动岛窗口定位中断。")?
        .map_err(str::to_owned)
}

#[tauri::command]
pub async fn desktop_island_open<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
) -> Result<(), String> {
    allowed(&view, &["main"])?;
    #[cfg(target_os = "macos")]
    {
        let window = if let Some(existing) = app.get_webview_window(ISLAND) {
            existing
        } else {
            WebviewWindowBuilder::new(&app, ISLAND, WebviewUrl::App("index.html".into()))
                .title("NekoPapa 灵动岛")
                .inner_size(174.0, 38.0)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .visible_on_all_workspaces(true)
                .resizable(false)
                .shadow(false)
                .visible(false)
                .build()
                .map_err(|_| "无法创建灵动岛窗口。")?
        };
        position(
            &app,
            window
                .inner_size()
                .is_ok_and(|size| size.width as f64 / window.scale_factor().unwrap_or(1.0) > 200.0),
            true,
        )
        .await
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Err("灵动岛需要 macOS 桌面应用。".into())
    }
}

#[tauri::command]
pub async fn desktop_island_expand<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
    expanded: bool,
) -> Result<(), String> {
    allowed(&view, &[ISLAND])?;
    #[cfg(target_os = "macos")]
    return position(&app, expanded, false).await;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, expanded);
        Err("灵动岛需要 macOS 桌面应用。".into())
    }
}

#[tauri::command]
pub async fn desktop_overlay_close<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
    label: String,
) -> Result<(), String> {
    allowed(&view, &["main", ISLAND, PET])?;
    if !matches!(label.as_str(), ISLAND | PET) || (view.label() != "main" && label != view.label())
    {
        return Err("无法关闭此窗口。".into());
    }
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|_| "无法关闭桌面窗口。")?;
    }
    if label == PET {
        crate::desktop_pet::release(&app);
    }
    Ok(())
}
