//! NekoPapa's own folder on this computer (the system's app data directory,
//! e.g. ~/Library/Application Support/app.nekopapa.desktop on macOS), like
//! ~/.codex or ~/.claude for those tools. Layout:
//!
//! - `data/`  — the local database `workspace.sqlite` (chat history, see
//!   chat_db.rs and docs/local-data-model.md);
//! - `files/` — attachments and generated files (reserved, not written yet);
//! - `cache/` — anything that can be rebuilt; 设置 → 数据 can empty it;
//! - `logs/`  — host logs (reserved).
//!
//! Only the store names in `STORES` can be read or written, so the front end
//! never passes a path. The front end owns the contents and their checks
//! (src/platform/app-data-storage.ts). The database is opened once, on first
//! use, which also imports the JSON file the chat history used before.

use crate::chat_db;
use rusqlite::Connection;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime};

pub const SECTIONS: [&str; 4] = ["data", "files", "cache", "logs"];
pub const STORES: [&str; 1] = ["chat-threads"];
const MAX_STORE: usize = 64 * 1024 * 1024;

/// The open database; `None` until first use, and again after a failed open so the next call retries.
#[derive(Default)]
pub struct AppDataState(Mutex<Option<Connection>>);

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

pub(crate) fn root_of<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|_| "无法确定本机数据文件夹。".to_string())?;
    ensure_layout(&root)?;
    Ok(root)
}

pub fn ensure_layout(root: &Path) -> Result<(), String> {
    for section in SECTIONS {
        fs::create_dir_all(root.join(section))
            .map_err(|_| format!("无法创建数据文件夹 {section}/。"))?;
    }
    Ok(())
}

fn check_store(name: &str) -> Result<(), String> {
    if STORES.contains(&name) {
        Ok(())
    } else {
        Err("未知的数据文件。".into())
    }
}

/// Runs `job` on the database, opening it (and importing the old JSON file) first if needed.
fn with_db<R: Runtime, T>(
    app: &AppHandle<R>,
    job: impl FnOnce(&mut Connection) -> Result<T, String>,
) -> Result<T, String> {
    let root = root_of(app)?;
    let state = app.state::<AppDataState>();
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "本机数据库暂时不可用，请重启 NekoPapa。".to_string())?;
    if guard.is_none() {
        let data = root.join("data");
        let mut conn = chat_db::open(&data.join(chat_db::DATABASE_FILE))?;
        chat_db::import_legacy(&mut conn, &data)?;
        *guard = Some(conn);
    }
    job(guard.as_mut().expect("opened above"))
}

pub fn read_stores(conn: &Connection) -> Result<Vec<StoreFile>, String> {
    Ok(chat_db::read_envelope(conn)?
        .map(|text| StoreFile {
            name: STORES[0].into(),
            text,
        })
        .into_iter()
        .collect())
}

pub fn write_store(conn: &mut Connection, name: &str, text: &str) -> Result<(), String> {
    check_store(name)?;
    if text.len() > MAX_STORE {
        return Err("聊天记录超过 64 MB，未写入。".into());
    }
    chat_db::save_envelope(conn, text)
}

/// Size and file count of a folder; symbolic links are counted, never followed.
fn measure(path: &Path) -> (u64, u64) {
    let Ok(entries) = fs::read_dir(path) else {
        return (0, 0);
    };
    entries.flatten().fold((0, 0), |(bytes, files), entry| {
        let Ok(meta) = entry.path().symlink_metadata() else {
            return (bytes, files);
        };
        if meta.is_dir() {
            let (more, count) = measure(&entry.path());
            (bytes + more, files + count)
        } else {
            (bytes + meta.len(), files + 1)
        }
    })
}

pub fn info(root: &Path) -> DataInfo {
    let sections = SECTIONS
        .iter()
        .map(|id| {
            let path = root.join(id);
            let (bytes, files) = measure(&path);
            SectionUsage {
                id,
                path: path.to_string_lossy().into_owned(),
                bytes,
                files,
            }
        })
        .collect();
    DataInfo {
        root: root.to_string_lossy().into_owned(),
        sections,
    }
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

async fn blocking<T: Send + 'static>(
    job: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(job)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn app_data_read<R: Runtime>(app: AppHandle<R>) -> Result<Vec<StoreFile>, String> {
    blocking(move || with_db(&app, |conn| read_stores(conn))).await
}

#[tauri::command]
pub async fn app_data_write<R: Runtime>(
    app: AppHandle<R>,
    name: String,
    text: String,
) -> Result<(), String> {
    blocking(move || with_db(&app, |conn| write_store(conn, &name, &text))).await
}

/// Full-text search over every chat message (quick search).
#[tauri::command]
pub async fn app_data_search<R: Runtime>(
    app: AppHandle<R>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<chat_db::SearchHit>, String> {
    blocking(move || {
        with_db(&app, |conn| {
            chat_db::search(conn, &query, limit.unwrap_or(20).min(50))
        })
    })
    .await
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
pub async fn app_data_open<R: Runtime>(
    app: AppHandle<R>,
    section: Option<String>,
) -> Result<(), String> {
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
