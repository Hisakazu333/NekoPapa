//! Project folder check for the desktop app. Mirrors the browser-preview
//! endpoint in scripts/project-folder-api.ts and returns the shape read by
//! src/app/projects/project-folder-info.ts: it resolves the path, confirms it is a
//! folder and reads its Git HEAD. It never lists files or runs commands.

use serde::Serialize;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[derive(Serialize, Debug, PartialEq)]
pub struct FolderGit {
    #[serde(skip_serializing_if = "Option::is_none")]
    branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    commit: Option<String>,
    worktree: bool,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct FolderInfo {
    path: String,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    git: Option<FolderGit>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct FolderCheck {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    folder: Option<FolderInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<&'static str>,
}

fn problem(reason: &'static str) -> FolderCheck {
    FolderCheck {
        ok: false,
        folder: None,
        reason: Some(reason),
    }
}

#[tauri::command]
pub fn inspect_project_folder(path: String) -> FolderCheck {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from);
    inspect(&path, home.as_deref())
}

pub fn inspect(input: &str, home: Option<&Path>) -> FolderCheck {
    let trimmed = input.trim();
    if trimmed.is_empty() || trimmed.len() > 1024 || trimmed.chars().any(char::is_control) {
        return problem("invalid");
    }
    let expanded = match (trimmed, home) {
        ("~", Some(home)) => home.to_path_buf(),
        (rest, Some(home)) if rest.starts_with("~/") => home.join(&rest[2..]),
        (rest, _) => PathBuf::from(rest),
    };
    if !expanded.is_absolute() {
        return problem("invalid");
    }
    let path = match fs::canonicalize(&expanded) {
        Ok(path) => path,
        Err(error) => return problem(io_reason(error.kind())),
    };
    match fs::metadata(&path) {
        Ok(meta) if meta.is_dir() => {}
        Ok(_) => return problem("not_directory"),
        Err(error) => return problem(io_reason(error.kind())),
    }
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned());
    let git = read_git(&path);
    FolderCheck {
        ok: true,
        folder: Some(FolderInfo {
            path: path.to_string_lossy().into_owned(),
            name,
            git,
        }),
        reason: None,
    }
}

fn io_reason(kind: ErrorKind) -> &'static str {
    match kind {
        ErrorKind::NotFound => "not_found",
        ErrorKind::PermissionDenied => "denied",
        _ => "unavailable",
    }
}

fn read_git(folder: &Path) -> Option<FolderGit> {
    for current in folder.ancestors() {
        let marker = current.join(".git");
        let Ok(meta) = fs::metadata(&marker) else {
            continue;
        };
        let (git_dir, worktree) = if meta.is_file() {
            let text = fs::read_to_string(&marker).ok()?;
            let pointer = text
                .lines()
                .find_map(|line| line.strip_prefix("gitdir:"))?
                .trim();
            let dir = current.join(pointer);
            let worktree = dir.components().any(|part| part.as_os_str() == "worktrees");
            (dir, worktree)
        } else {
            (marker, false)
        };
        let head = fs::read_to_string(git_dir.join("HEAD")).ok()?;
        let (branch, commit) = parse_head(&head);
        return Some(FolderGit {
            branch,
            commit,
            worktree,
        });
    }
    None
}

fn parse_head(head: &str) -> (Option<String>, Option<String>) {
    let text = head.trim();
    if let Some(branch) = text
        .strip_prefix("ref:")
        .map(str::trim)
        .and_then(|r| r.strip_prefix("refs/heads/"))
    {
        return (Some(branch.to_string()), None);
    }
    let is_id =
        (text.len() == 40 || text.len() == 64) && text.chars().all(|c| c.is_ascii_hexdigit());
    (None, is_id.then(|| text[..7].to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(label: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("nekopapa-folder-{label}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::canonicalize(dir).unwrap()
    }

    #[test]
    fn rejects_relative_missing_and_file_paths() {
        let dir = scratch("problems");
        fs::write(dir.join("note.txt"), "x").unwrap();
        assert_eq!(inspect("NekoBuddy", None).reason, Some("invalid"));
        assert_eq!(inspect("", None).reason, Some("invalid"));
        assert_eq!(
            inspect(dir.join("missing").to_str().unwrap(), None).reason,
            Some("not_found")
        );
        assert_eq!(
            inspect(dir.join("note.txt").to_str().unwrap(), None).reason,
            Some("not_directory")
        );
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn expands_home_and_reads_branch_worktree_and_detached_head() {
        let dir = scratch("git");
        fs::create_dir_all(dir.join("repo/.git/worktrees/feature")).unwrap();
        fs::create_dir_all(dir.join("repo/src")).unwrap();
        fs::write(dir.join("repo/.git/HEAD"), "ref: refs/heads/main\n").unwrap();
        fs::write(
            dir.join("repo/.git/worktrees/feature/HEAD"),
            "0123456789abcdef0123456789abcdef01234567\n",
        )
        .unwrap();
        fs::create_dir_all(dir.join("feature")).unwrap();
        fs::write(
            dir.join("feature/.git"),
            format!(
                "gitdir: {}\n",
                dir.join("repo/.git/worktrees/feature").display()
            ),
        )
        .unwrap();

        let nested = inspect("~/repo/src/", Some(&dir)).folder.unwrap();
        assert_eq!(nested.name, "src");
        assert_eq!(
            nested.git,
            Some(FolderGit {
                branch: Some("main".into()),
                commit: None,
                worktree: false
            })
        );
        let linked = inspect(dir.join("feature").to_str().unwrap(), None)
            .folder
            .unwrap();
        assert_eq!(
            linked.git,
            Some(FolderGit {
                branch: None,
                commit: Some("0123456".into()),
                worktree: true
            })
        );
        assert_eq!(
            inspect(dir.to_str().unwrap(), None).folder.unwrap().git,
            None
        );
        fs::remove_dir_all(dir).unwrap();
    }
}
