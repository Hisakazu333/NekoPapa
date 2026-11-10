//! Read-only views of a project folder for the chat's tool panels: list a
//! directory, read a text file, and ask Git for the working tree's status and
//! diffs. Every path is resolved inside the project root, so `..` or symlinks
//! cannot reach outside it. Nothing here writes to the folder.
//! The browser preview mirrors this in scripts/project-workspace-api.ts.

use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

const MAX_ENTRIES: usize = 2000;
const MAX_FILE: u64 = 512 * 1024;
const MAX_GIT_OUTPUT: usize = 2 * 1024 * 1024;

#[derive(Serialize, Debug, PartialEq)]
pub struct Entry {
    name: String,
    path: String,
    kind: &'static str,
    size: u64,
}

#[derive(Serialize, Debug)]
pub struct Listing {
    entries: Vec<Entry>,
    truncated: bool,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileView {
    path: String,
    size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    binary: bool,
    too_large: bool,
}

#[derive(Serialize, Debug)]
pub struct GitOutput {
    repo: bool,
    output: String,
}

pub(crate) fn root_of(root: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(root);
    if !path.is_absolute() {
        return Err("项目文件夹必须是完整路径。".into());
    }
    let canonical = fs::canonicalize(&path).map_err(|_| "项目文件夹不存在或无法访问。".to_string())?;
    if !canonical.is_dir() {
        return Err("项目路径不是文件夹。".into());
    }
    Ok(canonical)
}

/// A relative path inside the project, with no `..`, root or prefix parts.
fn relative(path: &str) -> Result<PathBuf, String> {
    let candidate = Path::new(path);
    if path.len() > 4096 || candidate.components().any(|part| !matches!(part, Component::Normal(_) | Component::CurDir)) {
        return Err("路径无效。".into());
    }
    Ok(candidate.to_path_buf())
}

/// Joins and resolves symlinks, then confirms the result is still inside the root.
pub(crate) fn inside(root: &Path, path: &str) -> Result<PathBuf, String> {
    let joined = root.join(relative(path)?);
    let resolved = fs::canonicalize(&joined).map_err(|_| "文件不存在或无法访问。".to_string())?;
    if !resolved.starts_with(root) {
        return Err("该路径指向项目文件夹之外。".into());
    }
    Ok(resolved)
}

fn slash(path: &Path) -> String {
    path.components().map(|part| part.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/")
}

pub fn list(root: &str, dir: &str) -> Result<Listing, String> {
    let root = root_of(root)?;
    let folder = inside(&root, dir)?;
    let mut entries = Vec::new();
    let mut truncated = false;
    for item in fs::read_dir(&folder).map_err(|_| "无法读取该文件夹。".to_string())? {
        let Ok(item) = item else { continue };
        let name = item.file_name().to_string_lossy().into_owned();
        if name == ".git" {
            continue;
        }
        if entries.len() >= MAX_ENTRIES {
            truncated = true;
            break;
        }
        let Ok(kind) = item.file_type() else { continue };
        let size = if kind.is_file() { item.metadata().map(|meta| meta.len()).unwrap_or(0) } else { 0 };
        let kind = if kind.is_symlink() { "link" } else if kind.is_dir() { "dir" } else { "file" };
        let path = slash(&relative(dir)?.join(&name));
        entries.push(Entry { name, path, kind, size });
    }
    entries.sort_by(|a, b| (a.kind != "dir").cmp(&(b.kind != "dir")).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(Listing { entries, truncated })
}

pub fn read(root: &str, path: &str) -> Result<FileView, String> {
    let root = root_of(root)?;
    let file = inside(&root, path)?;
    let meta = fs::metadata(&file).map_err(|_| "文件不存在或无法访问。".to_string())?;
    if !meta.is_file() {
        return Err("这不是文件。".into());
    }
    let mut view = FileView { path: path.into(), size: meta.len(), text: None, binary: false, too_large: meta.len() > MAX_FILE };
    if view.too_large {
        return Ok(view);
    }
    let mut bytes = Vec::new();
    fs::File::open(&file).and_then(|mut handle| handle.read_to_end(&mut bytes)).map_err(|_| "无法读取该文件。".to_string())?;
    match String::from_utf8(bytes) {
        Ok(text) if !text.contains('\0') => view.text = Some(text),
        _ => view.binary = true,
    }
    Ok(view)
}

fn git(root: &Path, args: &[&str]) -> Result<std::process::Output, String> {
    Command::new("git")
        .arg("-C").arg(root)
        .args(["-c", "core.quotepath=false", "-c", "color.ui=false"])
        .args(args)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|_| "找不到 git 命令。请先安装 Git。".to_string())
}

fn capped(bytes: &[u8]) -> Result<String, String> {
    if bytes.len() > MAX_GIT_OUTPUT {
        return Err("变化太多，无法在这里显示。".into());
    }
    Ok(String::from_utf8_lossy(bytes).into_owned())
}

/// `git status` in porcelain v1 with NUL separators and the branch line.
pub fn status(root: &str) -> Result<GitOutput, String> {
    let root = root_of(root)?;
    let output = git(&root, &["status", "--porcelain=v1", "-z", "-b", "--untracked-files=all"])?;
    if !output.status.success() {
        return Ok(GitOutput { repo: false, output: String::new() });
    }
    Ok(GitOutput { repo: true, output: capped(&output.stdout)? })
}

/// The working tree against HEAD for one file (staged and unstaged together).
pub fn diff(root: &str, path: &str) -> Result<GitOutput, String> {
    let root = root_of(root)?;
    let path = slash(&relative(path)?);
    let against_head = git(&root, &["diff", "--no-ext-diff", "HEAD", "--", &path])?;
    // A repository without commits has no HEAD: compare the index instead.
    let output = if against_head.status.success() { against_head } else { git(&root, &["diff", "--no-ext-diff", "--cached", "--", &path])? };
    if !output.status.success() {
        return Err("Git 无法读取这个文件的差异。".into());
    }
    Ok(GitOutput { repo: true, output: capped(&output.stdout)? })
}

#[tauri::command]
pub async fn project_list_dir(root: String, dir: String) -> Result<Listing, String> {
    tauri::async_runtime::spawn_blocking(move || list(&root, &dir)).await.map_err(|_| "读取失败。".to_string())?
}

#[tauri::command]
pub async fn project_read_file(root: String, path: String) -> Result<FileView, String> {
    tauri::async_runtime::spawn_blocking(move || read(&root, &path)).await.map_err(|_| "读取失败。".to_string())?
}

#[tauri::command]
pub async fn project_git_status(root: String) -> Result<GitOutput, String> {
    tauri::async_runtime::spawn_blocking(move || status(&root)).await.map_err(|_| "读取失败。".to_string())?
}

#[tauri::command]
pub async fn project_git_diff(root: String, path: String) -> Result<GitOutput, String> {
    tauri::async_runtime::spawn_blocking(move || diff(&root, &path)).await.map_err(|_| "读取失败。".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> PathBuf {
        let root = std::env::temp_dir().join(format!("nekopapa-workspace-{}-{}", std::process::id(), rand_suffix()));
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::write(root.join("src/main.ts"), "console.log(1);\n").unwrap();
        fs::write(root.join("README.md"), "# hi\n").unwrap();
        fs::write(root.join("image.bin"), [0u8, 159, 146, 150]).unwrap();
        fs::canonicalize(root).unwrap()
    }
    fn rand_suffix() -> u128 {
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    }

    #[test]
    fn lists_folders_first_and_skips_git() {
        let root = fixture();
        let listing = list(root.to_str().unwrap(), "").unwrap();
        let names: Vec<_> = listing.entries.iter().map(|entry| entry.name.as_str()).collect();
        assert_eq!(names, ["src", "image.bin", "README.md"]);
        assert_eq!(list(root.to_str().unwrap(), "src").unwrap().entries[0].path, "src/main.ts");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reads_text_flags_binary_and_refuses_escapes() {
        let root = fixture();
        let base = root.to_str().unwrap();
        assert_eq!(read(base, "README.md").unwrap().text.as_deref(), Some("# hi\n"));
        assert!(read(base, "image.bin").unwrap().binary);
        assert!(read(base, "../etc/passwd").is_err());
        assert!(read(base, "/etc/passwd").is_err());
        assert!(list(base, "..").is_err());
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink("/etc", root.join("outside")).unwrap();
            assert!(list(base, "outside").is_err());
        }
        assert!(list("relative/path", "").is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
