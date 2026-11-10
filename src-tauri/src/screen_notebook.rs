use crate::desktop_tools::{allowed, data_root, ISLAND};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Emitter, Manager, Runtime, Webview};

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NoteKind {
    Study,
    Code,
}

impl NoteKind {
    fn folder(self) -> &'static str {
        match self {
            Self::Study => "Study",
            Self::Code => "Code",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Study => "学习笔记",
            Self::Code => "代码草稿",
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotebookInfo {
    directory: String,
    screen_permission: bool,
    capture_enabled: bool,
}

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum ScreenResult {
    Captured {
        text: Option<String>,
        preview: String,
    },
    Cancelled,
    PermissionRequired,
}

#[derive(Default)]
pub struct CaptureGate(std::sync::Mutex<()>);

#[cfg(target_os = "macos")]
mod mac {
    use super::*;
    use std::{
        ffi::{c_char, c_void, CStr, CString},
        os::unix::ffi::OsStrExt,
        process::Command,
        sync::mpsc,
        time::Duration,
    };

    unsafe extern "C" {
        fn neko_can_capture(request: bool) -> bool;
        fn neko_recognize_text(file: *const c_char) -> *mut c_char;
        fn neko_capture_preview(file: *const c_char) -> *mut c_char;
        fn neko_free_text(text: *mut c_char);
        fn neko_animate_screen_capture(
            dark: bool,
            complete: extern "C" fn(*mut c_void),
            context: *mut c_void,
        );
    }

    pub fn permission(request: bool) -> bool {
        unsafe { neko_can_capture(request) }
    }

    pub fn reveal<R: Runtime>(window: &tauri::WebviewWindow<R>, dark: bool) -> Result<(), String> {
        extern "C" fn done(context: *mut c_void) {
            // AppKit returns this sender exactly once, after ordering out the panel.
            let sender = unsafe { Box::from_raw(context.cast::<mpsc::Sender<()>>()) };
            let _ = sender.send(());
        }
        let (sender, receiver) = mpsc::channel();
        window
            .run_on_main_thread(move || {
                let context = Box::into_raw(Box::new(sender)).cast::<c_void>();
                unsafe { neko_animate_screen_capture(dark, done, context) };
            })
            .map_err(|_| "无法播放截屏动效。")?;
        receiver
            .recv_timeout(Duration::from_secs(3))
            .map_err(|_| "截屏动效未正常结束，请重试。".into())
    }

    fn read_image(
        path: &Path,
        read: unsafe extern "C" fn(*const c_char) -> *mut c_char,
        limit: usize,
    ) -> Option<String> {
        let path = CString::new(path.as_os_str().as_bytes()).ok()?;
        let text = unsafe { read(path.as_ptr()) };
        if text.is_null() {
            return None;
        }
        let result = unsafe { CStr::from_ptr(text) }
            .to_string_lossy()
            .chars()
            .take(limit)
            .collect();
        unsafe { neko_free_text(text) };
        Some(result)
    }

    pub fn capture(cache: &Path) -> Result<ScreenResult, String> {
        fs::create_dir_all(cache).map_err(|_| "无法准备截图临时目录。")?;
        let temporary = tempfile::Builder::new()
            .prefix("capture-")
            .tempdir_in(cache)
            .map_err(|_| "无法准备截图。")?;
        let path = temporary.path().join("selection.png");
        let result = Command::new("/usr/sbin/screencapture")
            .args(["-i", "-s", "-x", "-t", "png"])
            .arg(&path)
            .output()
            .map_err(|_| "无法启动系统截图。")?;
        if !path.is_file() {
            return if result.status.success() || result.stderr.is_empty() {
                Ok(ScreenResult::Cancelled)
            } else {
                Err("系统截图未完成，请检查屏幕录制权限后重试。".into())
            };
        }
        if !result.status.success() {
            return Err("系统截图未完成。".into());
        }
        if fs::metadata(&path).map_err(|_| "无法读取截图。")?.len() > 48 * 1024 * 1024 {
            return Err("截图太大，请缩小选区。".into());
        }
        let preview = read_image(&path, neko_capture_preview, 2_000_000)
            .ok_or("无法预览截图，请重新框选。")?;
        Ok(ScreenResult::Captured {
            text: read_image(&path, neko_recognize_text, 60_000),
            preview: format!("data:image/jpeg;base64,{preview}"),
        })
    }
}

fn note_directory<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(data_root(app)?.join("ScreenNotebook"))
}

fn write_note(root: &Path, kind: NoteKind, title: &str, body: &str) -> Result<PathBuf, String> {
    let title = title.trim();
    let body = body.trim();
    if title.is_empty() || title.chars().count() > 100 || title.contains(['\n', '\r', '\0']) {
        return Err("请输入一行标题，最多 100 个字符。".into());
    }
    if body.is_empty() || body.len() > 256_000 || body.contains('\0') {
        return Err("请输入笔记正文，或缩短过长的内容。".into());
    }
    let directory = root.join(kind.folder());
    fs::create_dir_all(&directory).map_err(|_| "无法创建屏幕笔记目录。")?;
    let mut temporary =
        tempfile::NamedTempFile::new_in(&directory).map_err(|_| "无法写入笔记。")?;
    writeln!(temporary, "# {title}\n\n{body}").map_err(|_| "笔记写入失败。")?;
    temporary
        .as_file()
        .sync_all()
        .map_err(|_| "无法将笔记保存到磁盘。")?;
    let prefix: String = title
        .chars()
        .take(34)
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, '-' | '_') {
                c
            } else {
                '-'
            }
        })
        .collect();
    let nonce = temporary
        .path()
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("无法生成笔记文件名。")?;
    let path = directory.join(format!(
        "{}-{}.md",
        prefix.trim_matches('-'),
        nonce.trim_start_matches('.')
    ));
    temporary
        .persist_noclobber(&path)
        .map_err(|_| "笔记保存失败，请重试。")?;
    Ok(path)
}

#[tauri::command]
pub async fn screen_notebook_info<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
) -> Result<NotebookInfo, String> {
    allowed(&view, &["main", ISLAND])?;
    #[cfg(target_os = "macos")]
    let screen_permission = mac::permission(false);
    #[cfg(not(target_os = "macos"))]
    let screen_permission = false;
    Ok(NotebookInfo {
        directory: note_directory(&app)?.to_string_lossy().into(),
        screen_permission,
        capture_enabled: app.get_webview_window(ISLAND).is_some(),
    })
}

#[tauri::command]
pub async fn screen_capture_feedback<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
    message: String,
) -> Result<(), String> {
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
    allowed(&view, &[ISLAND])?;
    app.dialog()
        .message(message.chars().take(240).collect::<String>())
        .title("屏幕取材")
        .kind(MessageDialogKind::Warning)
        .show(|_| {});
    Ok(())
}

#[tauri::command]
pub async fn screen_permission_settings<R: Runtime>(view: Webview<R>) -> Result<(), String> {
    allowed(&view, &["main", ISLAND])?;
    #[cfg(target_os = "macos")]
    return std::process::Command::new("/usr/bin/open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
        .status()
        .ok()
        .filter(|status| status.success())
        .map(|_| ())
        .ok_or("无法打开屏幕录制设置。".into());
    #[cfg(not(target_os = "macos"))]
    Err("此操作需要 macOS。".into())
}

#[tauri::command]
pub async fn screen_select_text<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
    animate: bool,
    dark: bool,
) -> Result<ScreenResult, String> {
    allowed(&view, &[ISLAND])?;
    #[cfg(target_os = "macos")]
    {
        let cache = app
            .path()
            .app_cache_dir()
            .map_err(|_| "无法定位截图缓存。")?
            .join("ScreenNotebook");
        let task_app = app.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let gate = task_app.state::<CaptureGate>();
            let _active = gate
                .0
                .try_lock()
                .map_err(|_| "已经在截取屏幕，请先完成或取消。")?;
            if !mac::permission(true) {
                // The system may already be showing its own permission dialog.
                // Notify the workbench without opening a second native modal.
                let _ = task_app.emit_to("main", "screen-notebook:permission-required", ());
                return Ok(ScreenResult::PermissionRequired);
            }
            let window = task_app
                .get_webview_window(ISLAND)
                .ok_or("灵动岛已关闭。")?;
            if animate {
                mac::reveal(&window, dark)?;
            }
            mac::capture(&cache)
        })
        .await
        .map_err(|_| "截屏任务中断。")?
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, animate, dark);
        Err("截屏识字需要 macOS。".into())
    }
}

#[tauri::command]
pub async fn screen_note_save<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
    kind: NoteKind,
    title: String,
    body: String,
) -> Result<String, String> {
    allowed(&view, &[ISLAND])?;
    let root = note_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        write_note(&root, kind, &title, &body).map(|path| path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|_| "笔记保存中断。")?
}

#[tauri::command]
pub async fn screen_notes_open<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
    kind: Option<NoteKind>,
) -> Result<(), String> {
    allowed(&view, &["main", ISLAND])?;
    let mut root = note_directory(&app)?;
    if let Some(kind) = kind {
        root.push(kind.folder());
    }
    fs::create_dir_all(&root).map_err(|_| "无法创建屏幕笔记目录。")?;
    #[cfg(target_os = "macos")]
    return std::process::Command::new("/usr/bin/open")
        .arg(root)
        .spawn()
        .map(|_| ())
        .map_err(|_| "无法打开笔记目录。".into());
    #[cfg(not(target_os = "macos"))]
    Err("请在文件管理器中打开笔记目录。".into())
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScreenDraft {
    task: &'static str,
    text: String,
}

#[tauri::command]
pub async fn screen_note_to_chat<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
    kind: NoteKind,
    body: String,
) -> Result<(), String> {
    allowed(&view, &[ISLAND])?;
    if body.trim().is_empty() || body.len() > 256_000 {
        return Err("请先准备要交给工作台的文字。".into());
    }
    let main = app.get_webview_window("main").ok_or("工作台窗口未打开。")?;
    main.emit(
        "screen-notebook:draft",
        ScreenDraft {
            task: kind.label(),
            text: body,
        },
    )
    .map_err(|_| "无法将内容交给工作台。")?;
    let _ = main.show();
    let _ = main.set_focus();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notes_stay_inside_the_library_and_never_overwrite_each_other() {
        let root = tempfile::tempdir().unwrap();
        let first =
            write_note(root.path(), NoteKind::Study, "../../离散数学", "定义与例子").unwrap();
        let second = write_note(root.path(), NoteKind::Study, "../../离散数学", "下一页").unwrap();
        assert_ne!(first, second);
        assert_eq!(first.parent(), Some(root.path().join("Study").as_path()));
        assert_eq!(
            fs::read_to_string(first).unwrap(),
            "# ../../离散数学\n\n定义与例子\n"
        );
        assert!(write_note(root.path(), NoteKind::Code, "代码", " ").is_err());
    }
}
