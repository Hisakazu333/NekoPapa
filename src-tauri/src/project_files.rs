//! Walking a project folder's files: the index behind @ mentions and the
//! Agent's find_files tool, and the Agent's search_files tool. Both skip
//! version control, dependencies and build output, follow no symlinks, and
//! stop after MAX_FILES files so a huge folder cannot hold the window.

use crate::project_workspace::{root_of, slash};
use regex::{Regex, RegexBuilder};
use serde::Serialize;
use std::fs;
use std::path::Path;

const MAX_FILES: usize = 20_000;
const MAX_SEARCH_FILE: u64 = 1024 * 1024;
const MAX_LINE: usize = 240;
const MAX_PATTERN: usize = 2000;
/// Folders a walk never enters: version control, dependencies and build output.
const SKIPPED: [&str; 8] = [".git", "node_modules", "target", "dist", "build", ".next", ".venv", "__pycache__"];

#[derive(Serialize, Debug)]
pub struct FileIndex {
    paths: Vec<String>,
    truncated: bool,
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

/// Calls `visit` with each file's path relative to `root` (with `/`), in name
/// order folder by folder; `visit` returns false to stop. Returns whether the
/// walk ended at the file cap.
fn walk(root: &Path, mut visit: impl FnMut(&Path, String) -> bool) -> bool {
    let mut pending = vec![root.to_path_buf()];
    let mut seen = 0;
    while let Some(folder) = pending.pop() {
        let Ok(entries) = fs::read_dir(&folder) else { continue };
        let mut entries: Vec<_> = entries.flatten().collect();
        // Popped from the end: reversed, so folders are walked in name order.
        entries.sort_by_key(|entry| std::cmp::Reverse(entry.file_name()));
        let mut folders = Vec::new();
        let mut files = Vec::new();
        for entry in entries {
            let Ok(kind) = entry.file_type() else { continue };
            let name = entry.file_name().to_string_lossy().into_owned();
            if kind.is_dir() && !SKIPPED.contains(&name.as_str()) {
                folders.push(entry.path());
            } else if kind.is_file() {
                files.push(entry.path());
            }
        }
        for file in files.into_iter().rev() {
            seen += 1;
            if seen > MAX_FILES {
                return true;
            }
            let path = slash(file.strip_prefix(root).unwrap_or(&file));
            if !visit(&file, path) {
                return false;
            }
        }
        pending.extend(folders);
    }
    false
}

/// Every file in the project, for mentions and find_files.
pub fn index(root: &str) -> Result<FileIndex, String> {
    let root = root_of(root)?;
    let mut paths = Vec::new();
    let truncated = walk(&root, |_, path| {
        paths.push(path);
        true
    });
    Ok(FileIndex { paths, truncated })
}

fn trimmed(line: &str) -> String {
    let line = line.trim();
    match line.char_indices().nth(MAX_LINE) {
        Some((end, _)) => format!("{}…", &line[..end]),
        None => line.into(),
    }
}

fn compile(pattern: &str, case_sensitive: bool, what: &str) -> Result<Regex, String> {
    if pattern.len() > MAX_PATTERN {
        return Err(format!("{what}太长。"));
    }
    RegexBuilder::new(pattern)
        .case_insensitive(!case_sensitive)
        .size_limit(1 << 20)
        .build()
        .map_err(|error| format!("{what}不是有效的正则表达式：{error}"))
}

/// What to look for: text (or a regular expression), and optionally only in
/// files whose relative path matches `path_pattern` (a regular expression,
/// built by the window from a glob).
pub struct Query<'a> {
    pub text: &'a str,
    pub regex: bool,
    pub case_sensitive: bool,
    pub path_pattern: Option<&'a str>,
}

/// Lines matching the query in the project's text files, and files whose path matches it.
pub fn search(root: &str, query: &Query, limit: usize) -> Result<Search, String> {
    let root = root_of(root)?;
    let text = if query.regex { query.text.to_string() } else { query.text.trim().to_string() };
    if text.trim().is_empty() {
        return Err("请给出要搜索的文字。".into());
    }
    let source = if query.regex { text } else { regex::escape(&text) };
    let matcher = compile(&source, query.case_sensitive, "搜索内容")?;
    let only = match query.path_pattern {
        Some(pattern) if !pattern.is_empty() => Some(compile(pattern, true, "路径范围")?),
        _ => None,
    };
    let mut result = Search { hits: Vec::new(), truncated: false };
    let capped = walk(&root, |file, path| {
        if only.as_ref().is_some_and(|only| !only.is_match(&path)) {
            return true;
        }
        if result.hits.len() >= limit {
            result.truncated = true;
            return false;
        }
        if matcher.is_match(&path) {
            result.hits.push(Hit { path: path.clone(), line: 0, text: String::new() });
        }
        if fs::metadata(file).map(|meta| meta.len() > MAX_SEARCH_FILE).unwrap_or(true) {
            return true;
        }
        let Ok(content) = fs::read_to_string(file) else { return true };
        for (number, line) in content.lines().enumerate() {
            if result.hits.len() >= limit {
                result.truncated = true;
                return false;
            }
            if matcher.is_match(line) {
                result.hits.push(Hit { path: path.clone(), line: number + 1, text: trimmed(line) });
            }
        }
        true
    });
    result.truncated |= capped;
    Ok(result)
}

async fn blocking<T: Send + 'static>(job: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(job).await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn project_list_files(root: String) -> Result<FileIndex, String> {
    blocking(move || index(&root)).await
}

#[tauri::command]
pub async fn agent_search(root: String, query: String, regex: Option<bool>, case_sensitive: Option<bool>, path_pattern: Option<String>, limit: Option<usize>) -> Result<Search, String> {
    blocking(move || {
        let query = Query { text: &query, regex: regex.unwrap_or(false), case_sensitive: case_sensitive.unwrap_or(false), path_pattern: path_pattern.as_deref() };
        search(&root, &query, limit.unwrap_or(50).clamp(1, 200))
    })
    .await
}

#[cfg(test)]
#[path = "project_files_tests.rs"]
mod tests;
