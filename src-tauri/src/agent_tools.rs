//! The file tools the chat Agent calls inside a project folder: search the
//! folder, write or edit a file, and undo one of those changes. Reading and
//! listing reuse project_workspace.rs; commands live in agent_command.rs.
//!
//! Every path is relative to the project root and is checked to stay inside
//! it (no `..`, absolute paths or symlinks out). Before each change the file's
//! previous contents are kept as a snapshot in `<appData>/data/snapshots/`, so
//! the change card can undo it. Undo refuses when the file was changed again
//! after the Agent wrote it, so it never discards someone else's edit.

use crate::agent_diff;
use crate::project_workspace::{inside, relative, root_of, slash};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{AppHandle, Runtime};

const MAX_WRITE: usize = 2 * 1024 * 1024;
const MAX_SEARCH_FILE: u64 = 1024 * 1024;
const MAX_SEARCH_FILES: usize = 20_000;
const MAX_LINE: usize = 240;
/// Folders a search never enters: version control, dependencies and build output.
const SKIPPED: [&str; 8] = [".git", "node_modules", "target", "dist", "build", ".next", ".venv", "__pycache__"];

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    path: String,
    created: bool,
    added: u32,
    removed: u32,
    diff: String,
    snapshot: String,
}

#[derive(Serialize, Deserialize)]
struct Snapshot {
    root: String,
    path: String,
    before: Option<String>,
    after: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Hit {
    path: String,
    line: usize,
    text: String,
}

#[derive(Serialize, Debug)]
pub struct Search {
    hits: Vec<Hit>,
    truncated: bool,
}

/// A file path inside the root that may not exist yet: its nearest existing
/// folder must resolve inside the root, and an existing file must too.
fn target(root: &Path, path: &str) -> Result<PathBuf, String> {
    let rel = relative(path)?;
    if rel.as_os_str().is_empty() {
        return Err("请给出项目内的文件路径。".into());
    }
    let joined = root.join(&rel);
    if joined.symlink_metadata().is_ok() {
        let resolved = inside(root, path)?;
        if resolved.is_dir() {
            return Err("这是文件夹，不是文件。".into());
        }
        return Ok(resolved);
    }
    let mut ancestor = joined.parent();
    while let Some(folder) = ancestor {
        if folder.exists() {
            let resolved = fs::canonicalize(folder).map_err(|_| "无法访问目标文件夹。".to_string())?;
            if !resolved.starts_with(root) {
                return Err("该路径指向项目文件夹之外。".into());
            }
            break;
        }
        ancestor = folder.parent();
    }
    Ok(joined)
}

static NEXT: AtomicU32 = AtomicU32::new(0);

fn snapshot_id() -> String {
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|time| time.as_nanos()).unwrap_or(0);
    format!("{nanos:x}-{:x}", NEXT.fetch_add(1, Ordering::Relaxed))
}

fn snapshot_file(store: &Path, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || id.len() > 64 || !id.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return Err("快照编号无效。".into());
    }
    Ok(store.join(format!("{id}.json")))
}

/// Writes `text` to `path` (creating folders), keeping a snapshot of what was there.
pub fn write(store: &Path, root: &str, path: &str, text: &str) -> Result<Change, String> {
    if text.len() > MAX_WRITE {
        return Err("内容超过 2 MB，未写入。".into());
    }
    let root = root_of(root)?;
    let file = target(&root, path)?;
    let before = match fs::read(&file) {
        Ok(bytes) => Some(String::from_utf8(bytes).map_err(|_| "这是二进制文件，不能用文本覆盖。".to_string())?),
        Err(_) => None,
    };
    let id = snapshot_id();
    let snapshot = Snapshot { root: root.to_string_lossy().into_owned(), path: slash(&relative(path)?), before, after: text.into() };
    fs::create_dir_all(store).map_err(|_| "无法创建快照文件夹。".to_string())?;
    let json = serde_json::to_string(&snapshot).map_err(|error| error.to_string())?;
    fs::write(snapshot_file(store, &id)?, json).map_err(|_| "无法保存修改前的快照，未写入。".to_string())?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|_| "无法创建目标文件夹。".to_string())?;
    }
    fs::write(&file, text).map_err(|_| "无法写入该文件。".to_string())?;
    let diff = agent_diff::unified(snapshot.before.as_deref().unwrap_or(""), text);
    Ok(Change { path: snapshot.path, created: snapshot.before.is_none(), added: diff.added, removed: diff.removed, diff: diff.text, snapshot: id })
}

/// Replaces the one place `old` occurs in the file with `new`.
pub fn edit(store: &Path, root: &str, path: &str, old: &str, new: &str) -> Result<Change, String> {
    let base = root_of(root)?;
    let current = fs::read_to_string(inside(&base, path)?).map_err(|_| "无法以文本读取该文件。".to_string())?;
    if old.is_empty() {
        return Err("要替换的原文不能为空。".into());
    }
    match current.matches(old).count() {
        0 => Err("文件中找不到要替换的原文，请先读取文件确认内容。".into()),
        1 => write(store, root, path, &current.replacen(old, new, 1)),
        count => Err(format!("原文在文件中出现了 {count} 次，请包含更多上下文使其唯一。")),
    }
}

/// "ready" (can undo), "undone" (already undone) or "changed" (edited since).
pub fn snapshot_state(store: &Path, id: &str) -> Result<&'static str, String> {
    let Ok(json) = fs::read_to_string(snapshot_file(store, id)?) else { return Ok("undone") };
    let snapshot: Snapshot = serde_json::from_str(&json).map_err(|_| "快照已损坏。".to_string())?;
    let file = Path::new(&snapshot.root).join(&snapshot.path);
    Ok(if fs::read_to_string(file).ok().as_deref() == Some(snapshot.after.as_str()) { "ready" } else { "changed" })
}

/// Puts the file back as it was before the change (removing a file the change created).
pub fn undo(store: &Path, id: &str) -> Result<(), String> {
    let snapshot_path = snapshot_file(store, id)?;
    let json = fs::read_to_string(&snapshot_path).map_err(|_| "这次修改已经撤销过了。".to_string())?;
    let snapshot: Snapshot = serde_json::from_str(&json).map_err(|_| "快照已损坏，无法撤销。".to_string())?;
    let root = root_of(&snapshot.root)?;
    let file = target(&root, &snapshot.path)?;
    if fs::read_to_string(&file).ok().as_deref() != Some(snapshot.after.as_str()) {
        return Err("文件在这次修改之后又被改动过，为避免覆盖，没有撤销。".into());
    }
    match &snapshot.before {
        Some(text) => fs::write(&file, text),
        None => fs::remove_file(&file),
    }
    .map_err(|_| "无法恢复该文件。".to_string())?;
    let _ = fs::remove_file(snapshot_path);
    Ok(())
}

fn trimmed(line: &str) -> String {
    let line = line.trim();
    match line.char_indices().nth(MAX_LINE) {
        Some((end, _)) => format!("{}…", &line[..end]),
        None => line.into(),
    }
}

/// Lines containing `query` (ignoring case) in the project's text files, and files whose path contains it.
pub fn search(root: &str, query: &str, limit: usize) -> Result<Search, String> {
    let root = root_of(root)?;
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return Err("请给出要搜索的文字。".into());
    }
    let mut result = Search { hits: Vec::new(), truncated: false };
    let mut pending = vec![root.clone()];
    let mut visited = 0;
    while let Some(folder) = pending.pop() {
        let Ok(entries) = fs::read_dir(&folder) else { continue };
        let mut entries: Vec<_> = entries.flatten().collect();
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            let Ok(kind) = entry.file_type() else { continue };
            let name = entry.file_name().to_string_lossy().into_owned();
            if kind.is_dir() {
                if !SKIPPED.contains(&name.as_str()) {
                    pending.push(entry.path());
                }
                continue;
            }
            if !kind.is_file() {
                continue;
            }
            visited += 1;
            if visited > MAX_SEARCH_FILES || result.hits.len() >= limit {
                result.truncated = true;
                return Ok(result);
            }
            let path = slash(entry.path().strip_prefix(&root).unwrap_or(&entry.path()));
            if path.to_lowercase().contains(&needle) {
                result.hits.push(Hit { path: path.clone(), line: 0, text: String::new() });
            }
            if entry.metadata().map(|meta| meta.len() > MAX_SEARCH_FILE).unwrap_or(true) {
                continue;
            }
            let Ok(text) = fs::read_to_string(entry.path()) else { continue };
            for (number, line) in text.lines().enumerate() {
                if result.hits.len() >= limit {
                    result.truncated = true;
                    return Ok(result);
                }
                if line.to_lowercase().contains(&needle) {
                    result.hits.push(Hit { path: path.clone(), line: number + 1, text: trimmed(line) });
                }
            }
        }
    }
    Ok(result)
}

fn store<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(crate::app_data::root_of(app)?.join("data").join("snapshots"))
}

async fn blocking<T: Send + 'static>(job: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(job).await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn agent_search(root: String, query: String, limit: Option<usize>) -> Result<Search, String> {
    blocking(move || search(&root, &query, limit.unwrap_or(50).clamp(1, 200))).await
}

#[tauri::command]
pub async fn agent_write_file<R: Runtime>(app: AppHandle<R>, root: String, path: String, text: String) -> Result<Change, String> {
    let store = store(&app)?;
    blocking(move || write(&store, &root, &path, &text)).await
}

#[tauri::command]
pub async fn agent_edit_file<R: Runtime>(app: AppHandle<R>, root: String, path: String, old: String, new: String) -> Result<Change, String> {
    let store = store(&app)?;
    blocking(move || edit(&store, &root, &path, &old, &new)).await
}

#[tauri::command]
pub async fn agent_snapshot_state<R: Runtime>(app: AppHandle<R>, snapshot: String) -> Result<&'static str, String> {
    let store = store(&app)?;
    blocking(move || snapshot_state(&store, &snapshot)).await
}

#[tauri::command]
pub async fn agent_undo<R: Runtime>(app: AppHandle<R>, snapshot: String) -> Result<(), String> {
    let store = store(&app)?;
    blocking(move || undo(&store, &snapshot)).await
}

#[cfg(test)]
#[path = "agent_tools_tests.rs"]
mod tests;
