//! NekoPapa's own folder on this computer (the system's app data directory,
//! e.g. ~/Library/Application Support/app.nekopapa.desktop on macOS), like
//! ~/.codex or ~/.claude for those tools. Layout:
//!
//! - `data/`  — stores the app keeps as files instead of WebView storage
//!   (chat history), one JSON file each, written atomically;
//! - `files/` — attachments and generated files (reserved, not written yet);
//! - `cache/` — anything that can be rebuilt; 设置 → 数据 can empty it;
//! - `logs/`  — host logs (reserved).
//!
//! Only the store names in `STORES` can be read or written, so the front end
//! never passes a path. The front end owns the contents and their checks
//! (src/platform/app-data-storage.ts).

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager, Runtime};

pub const SECTIONS: [&str; 4] = ["data", "files", "cache", "logs"];
pub const STORES: [&str; 1] = ["chat-threads"];
const MAX_STORE: usize = 64 * 1024 * 1024;

#[derive(Serialize, Debug, PartialEq)]
pub struct StoreFile {
    name: String,
    text: String,
}

#[derive(Serialize, Debug)]
pub struct SectionUsage {
    id: &'static str,
    path: String,
    bytes: u64,
    files: u64,
}

#[derive(Serialize, Debug)]
pub struct DataInfo {
    root: String,
    sections: Vec<SectionUsage>,
}

fn root_of<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|_| "无法确定本机数据文件夹。".to_string())?;
    ensure_layout(&root)?;
    Ok(root)
}

pub fn ensure_layout(root: &Path) -> Result<(), String> {
    for section in SECTIONS {
        fs::create_dir_all(root.join(section)).map_err(|_| format!("无法创建数据文件夹 {section}/。"))?;
    }
    Ok(())
}

fn store_path(root: &Path, name: &str) -> Result<PathBuf, String> {
    if !STORES.contains(&name) {
        return Err("未知的数据文件。".into());
    }
    Ok(root.join("data").join(format!("{name}.json")))
}

/// Every store that exists; a missing file is simply absent from the list.
pub fn read_stores(root: &Path) -> Result<Vec<StoreFile>, String> {
    let mut stores = Vec::new();
    for name in STORES {
        let path = store_path(root, name)?;
        match fs::read(&path) {
            Ok(bytes) => {
                let text = String::from_utf8(bytes).map_err(|_| format!("{name}.json 不是 UTF-8 文本。"))?;
                stores.push(StoreFile { name: name.into(), text });
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err(format!("无法读取 {name}.json。")),
        }
    }
    Ok(stores)
}

/// Writes beside the file, flushes it to disk, then renames over the old
/// one, so a crash leaves either the old or the new contents, never half.
pub fn write_store(root: &Path, name: &str, text: &str) -> Result<(), String> {
    let path = store_path(root, name)?;
    if text.len() > MAX_STORE {
        return Err(format!("{name}.json 超过 64 MB，未写入。"));
    }
    let temp = path.with_extension(format!("json.{}.tmp", std::process::id()));
    let result = (|| {
        let mut file = fs::File::create(&temp)?;
        file.write_all(text.as_bytes())?;
        file.sync_all()?;
        fs::rename(&temp, &path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
        return Err(format!("无法写入 {name}.json，原文件保持不变。"));
    }
    Ok(())
}

/// Size and file count of a folder; symbolic links are counted, never followed.
fn measure(path: &Path) -> (u64, u64) {
    let Ok(entries) = fs::read_dir(path) else { return (0, 0) };
    entries.flatten().fold((0, 0), |(bytes, files), entry| {
        let Ok(meta) = entry.path().symlink_metadata() else { return (bytes, files) };
        if meta.is_dir() {
            let (more, count) = measure(&entry.path());
            (bytes + more, files + count)
        } else {
            (bytes + meta.len(), files + 1)
        }
    })
}

pub fn info(root: &Path) -> DataInfo {
    let sections = SECTIONS.iter().map(|id| {
        let path = root.join(id);
        let (bytes, files) = measure(&path);
        SectionUsage { id, path: path.to_string_lossy().into_owned(), bytes, files }
    }).collect();
    DataInfo { root: root.to_string_lossy().into_owned(), sections }
}

/// Empties `cache/` (the folder itself stays). Links inside are removed, not followed.
pub fn clear_cache(root: &Path) -> Result<u64, String> {
    let cache = root.join("cache");
    let (bytes, _) = measure(&cache);
    let entries = fs::read_dir(&cache).map_err(|_| "无法读取缓存文件夹。".to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        let removed = match path.symlink_metadata() {
            Ok(meta) if meta.is_dir() => fs::remove_dir_all(&path),
            _ => fs::remove_file(&path),
        };
        removed.map_err(|_| "部分缓存无法删除，请关闭正在使用它的程序后重试。".to_string())?;
    }
    Ok(bytes)
}

fn reveal(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let mut command = Command::new("xdg-open");
    match command.arg(path).status() {
        Ok(status) if status.success() || cfg!(target_os = "windows") => Ok(()),
        _ => Err("无法在文件管理器中打开数据文件夹。".into()),
    }
}

async fn blocking<T: Send + 'static>(job: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(job).await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn app_data_read<R: Runtime>(app: AppHandle<R>) -> Result<Vec<StoreFile>, String> {
    let root = root_of(&app)?;
    blocking(move || read_stores(&root)).await
}

#[tauri::command]
pub async fn app_data_write<R: Runtime>(app: AppHandle<R>, name: String, text: String) -> Result<(), String> {
    let root = root_of(&app)?;
    blocking(move || write_store(&root, &name, &text)).await
}

#[tauri::command]
pub async fn app_data_info<R: Runtime>(app: AppHandle<R>) -> Result<DataInfo, String> {
    let root = root_of(&app)?;
    blocking(move || Ok(info(&root))).await
}

#[tauri::command]
pub async fn app_data_clear_cache<R: Runtime>(app: AppHandle<R>) -> Result<u64, String> {
    let root = root_of(&app)?;
    blocking(move || clear_cache(&root)).await
}

/// Opens the root, or one of its sections, in Finder / Explorer.
#[tauri::command]
pub async fn app_data_open<R: Runtime>(app: AppHandle<R>, section: Option<String>) -> Result<(), String> {
    let root = root_of(&app)?;
    let target = match section.as_deref() {
        None => root,
        Some(id) if SECTIONS.contains(&id) => root.join(id),
        Some(_) => return Err("未知的数据文件夹。".into()),
    };
    blocking(move || reveal(&target)).await
}

#[cfg(test)]
#[path = "app_data_tests.rs"]
mod tests;
