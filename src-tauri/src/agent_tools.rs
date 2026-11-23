//! The file tools the chat Agent calls inside a project folder: write or edit
//! a file, and undo one of those changes. Reading and listing reuse
//! project_workspace.rs, searching and finding files project_files.rs, and
//! commands live in agent_command.rs.
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
const MAX_EDITS: usize = 50;

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

/// One replacement in an edit: `old` must occur exactly once, or `replace_all` replaces every occurrence.
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Replacement {
    pub old: String,
    pub new: String,
    #[serde(default)]
    pub replace_all: bool,
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
            let resolved =
                fs::canonicalize(folder).map_err(|_| "无法访问目标文件夹。".to_string())?;
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
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|time| time.as_nanos())
        .unwrap_or(0);
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
        Ok(bytes) => Some(
            String::from_utf8(bytes).map_err(|_| "这是二进制文件，不能用文本覆盖。".to_string())?,
        ),
        Err(_) => None,
    };
    let id = snapshot_id();
    let snapshot = Snapshot {
        root: root.to_string_lossy().into_owned(),
        path: slash(&relative(path)?),
        before,
        after: text.into(),
    };
    fs::create_dir_all(store).map_err(|_| "无法创建快照文件夹。".to_string())?;
    let json = serde_json::to_string(&snapshot).map_err(|error| error.to_string())?;
    fs::write(snapshot_file(store, &id)?, json)
        .map_err(|_| "无法保存修改前的快照，未写入。".to_string())?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|_| "无法创建目标文件夹。".to_string())?;
    }
    fs::write(&file, text).map_err(|_| "无法写入该文件。".to_string())?;
    let diff = agent_diff::unified(snapshot.before.as_deref().unwrap_or(""), text);
    Ok(Change {
        path: snapshot.path,
        created: snapshot.before.is_none(),
        added: diff.added,
        removed: diff.removed,
        diff: diff.text,
        snapshot: id,
    })
}

/// Applies `edits` in order to the file's text and writes the result once,
/// so a change of several places is one snapshot and one undo. Nothing is
/// written if any edit does not apply; the error says which one and why.
pub fn edit(store: &Path, root: &str, path: &str, edits: &[Replacement]) -> Result<Change, String> {
    if edits.is_empty() || edits.len() > MAX_EDITS {
        return Err(format!("一次修改需要 1 到 {MAX_EDITS} 处替换。"));
    }
    let base = root_of(root)?;
    let mut text = fs::read_to_string(inside(&base, path)?)
        .map_err(|_| "无法以文本读取该文件。".to_string())?;
    let many = edits.len() > 1;
    for (index, replacement) in edits.iter().enumerate() {
        let which = if many {
            format!("第 {} 处替换：", index + 1)
        } else {
            String::new()
        };
        if replacement.old.is_empty() {
            return Err(format!("{which}要替换的原文不能为空。"));
        }
        let count = text.matches(&replacement.old).count();
        text = match count {
            0 => return Err(format!("{which}文件中找不到要替换的原文，请先读取文件确认内容（前面的替换会先生效再查找）。")),
            _ if replacement.replace_all => text.replace(&replacement.old, &replacement.new),
            1 => text.replacen(&replacement.old, &replacement.new, 1),
            count => return Err(format!("{which}原文在文件中出现了 {count} 次，请包含更多上下文使其唯一，或设 replaceAll。")),
        };
    }
    write(store, root, path, &text)
}

/// "ready" (can undo), "undone" (already undone) or "changed" (edited since).
pub fn snapshot_state(store: &Path, id: &str) -> Result<&'static str, String> {
    let Ok(json) = fs::read_to_string(snapshot_file(store, id)?) else {
        return Ok("undone");
    };
    let snapshot: Snapshot = serde_json::from_str(&json).map_err(|_| "快照已损坏。".to_string())?;
    let file = Path::new(&snapshot.root).join(&snapshot.path);
    Ok(
        if fs::read_to_string(file).ok().as_deref() == Some(snapshot.after.as_str()) {
            "ready"
        } else {
            "changed"
        },
    )
}

/// Puts the file back as it was before the change (removing a file the change created).
pub fn undo(store: &Path, id: &str) -> Result<(), String> {
    let snapshot_path = snapshot_file(store, id)?;
    let json =
        fs::read_to_string(&snapshot_path).map_err(|_| "这次修改已经撤销过了。".to_string())?;
    let snapshot: Snapshot =
        serde_json::from_str(&json).map_err(|_| "快照已损坏，无法撤销。".to_string())?;
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

fn store<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(crate::app_data::root_of(app)?
        .join("data")
        .join("snapshots"))
}

async fn blocking<T: Send + 'static>(
    job: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(job)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn agent_write_file<R: Runtime>(
    app: AppHandle<R>,
    root: String,
    path: String,
    text: String,
) -> Result<Change, String> {
    let store = store(&app)?;
    blocking(move || write(&store, &root, &path, &text)).await
}

#[tauri::command]
pub async fn agent_edit_file<R: Runtime>(
    app: AppHandle<R>,
    root: String,
    path: String,
    edits: Vec<Replacement>,
) -> Result<Change, String> {
    let store = store(&app)?;
    blocking(move || edit(&store, &root, &path, &edits)).await
}

#[tauri::command]
pub async fn agent_snapshot_state<R: Runtime>(
    app: AppHandle<R>,
    snapshot: String,
) -> Result<&'static str, String> {
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
