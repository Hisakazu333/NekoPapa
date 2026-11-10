//! The chat window's terminal panel: a login shell on a pseudo-terminal,
//! started in the project folder when the panel asks for one. Output goes to
//! the main window as `terminal://output` events and the end of the shell as
//! `terminal://exit`; input and resizes come back through commands. Sessions
//! end when the panel closes them or the app quits.

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct Terminals {
    sessions: Mutex<HashMap<u32, Session>>,
    next: AtomicU32,
}

#[derive(Serialize, Clone)]
struct Output {
    id: u32,
    data: String,
}

#[derive(Serialize, Clone)]
struct Exit {
    id: u32,
}

const MAX_SESSIONS: usize = 8;

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize { cols: cols.clamp(2, 1000), rows: rows.clamp(2, 1000), pixel_width: 0, pixel_height: 0 }
}

/// Splits off the longest valid UTF-8 prefix, keeping a cut-off character for the next read.
fn take_utf8(pending: &mut Vec<u8>) -> String {
    let valid = match std::str::from_utf8(pending) {
        Ok(_) => pending.len(),
        Err(error) if error.error_len().is_none() => error.valid_up_to(),
        // Bytes that can never be valid: hand them over replaced.
        Err(_) => pending.len(),
    };
    let rest = pending.split_off(valid);
    let text = String::from_utf8_lossy(pending).into_owned();
    *pending = rest;
    text
}

/// 设置 → 编辑器与终端 → Shell: one of the listed shells, found in the usual places.
fn find_shell(name: &str) -> Result<String, String> {
    if !["zsh", "bash", "fish", "pwsh"].contains(&name) {
        return Err("未知的 Shell。".into());
    }
    ["/bin", "/usr/bin", "/usr/local/bin", "/opt/homebrew/bin"]
        .iter()
        .map(|dir| PathBuf::from(dir).join(name))
        .find(|path| path.is_file())
        .map(|path| path.to_string_lossy().into_owned())
        .ok_or(format!("没有找到 {name}，请先安装，或在 设置 → 编辑器与终端 中选择其他 Shell。"))
}

#[tauri::command]
pub async fn terminal_open<R: Runtime>(app: AppHandle<R>, terminals: State<'_, Terminals>, cwd: Option<String>, cols: u16, rows: u16, shell: Option<String>) -> Result<u32, String> {
    if terminals.sessions.lock().map_err(|_| "终端不可用。")?.len() >= MAX_SESSIONS {
        return Err("同时最多打开 8 个终端。".into());
    }
    let pair = native_pty_system().openpty(size(cols, rows)).map_err(|_| "无法创建终端。".to_string())?;
    let shell = match shell.as_deref() {
        None | Some("system") => std::env::var("SHELL").unwrap_or_else(|_| if cfg!(windows) { "powershell.exe".into() } else { "/bin/zsh".into() }),
        Some(name) => find_shell(name)?,
    };
    let mut command = CommandBuilder::new(&shell);
    if !cfg!(windows) {
        command.arg("-l");
    }
    let home = std::env::var_os("HOME").map(PathBuf::from);
    let directory = cwd.map(PathBuf::from).filter(|path| path.is_absolute() && path.is_dir()).or(home);
    if let Some(directory) = directory {
        command.cwd(directory);
    }
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    let child = pair.slave.spawn_command(command).map_err(|_| format!("无法启动 {shell}。"))?;
    drop(pair.slave);
    let mut reader = pair.master.try_clone_reader().map_err(|_| "无法读取终端输出。".to_string())?;
    let writer = pair.master.take_writer().map_err(|_| "无法写入终端。".to_string())?;
    let id = terminals.next.fetch_add(1, Ordering::Relaxed) + 1;
    terminals.sessions.lock().map_err(|_| "终端不可用。")?.insert(id, Session { master: pair.master, writer, child });

    std::thread::spawn(move || {
        let mut buffer = [0u8; 16 * 1024];
        let mut pending = Vec::new();
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(read) => {
                    pending.extend_from_slice(&buffer[..read]);
                    let data = take_utf8(&mut pending);
                    if !data.is_empty() {
                        let _ = app.emit_to("main", "terminal://output", Output { id, data });
                    }
                }
            }
        }
        if let Some(state) = app.try_state::<Terminals>() {
            if let Ok(mut sessions) = state.sessions.lock() {
                sessions.remove(&id);
            }
        }
        let _ = app.emit_to("main", "terminal://exit", Exit { id });
    });
    Ok(id)
}

#[tauri::command]
pub async fn terminal_write(terminals: State<'_, Terminals>, id: u32, data: String) -> Result<(), String> {
    let mut sessions = terminals.sessions.lock().map_err(|_| "终端不可用。")?;
    let session = sessions.get_mut(&id).ok_or("终端已结束。")?;
    session.writer.write_all(data.as_bytes()).and_then(|_| session.writer.flush()).map_err(|_| "终端已结束。".to_string())
}

#[tauri::command]
pub async fn terminal_resize(terminals: State<'_, Terminals>, id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = terminals.sessions.lock().map_err(|_| "终端不可用。")?;
    let session = sessions.get(&id).ok_or("终端已结束。")?;
    session.master.resize(size(cols, rows)).map_err(|_| "无法调整终端大小。".to_string())
}

#[tauri::command]
pub async fn terminal_close(terminals: State<'_, Terminals>, id: u32) -> Result<(), String> {
    if let Some(mut session) = terminals.sessions.lock().map_err(|_| "终端不可用。")?.remove(&id) {
        let _ = session.child.kill();
    }
    Ok(())
}

impl Drop for Terminals {
    fn drop(&mut self) {
        if let Ok(mut sessions) = self.sessions.lock() {
            for (_, mut session) in sessions.drain() {
                let _ = session.child.kill();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_a_character_cut_between_reads() {
        let bytes = "终端".as_bytes();
        let mut pending = bytes[..4].to_vec();
        assert_eq!(take_utf8(&mut pending), "终");
        assert_eq!(pending, bytes[3..4]);
        pending.extend_from_slice(&bytes[4..]);
        assert_eq!(take_utf8(&mut pending), "端");
        assert!(pending.is_empty());
        let mut broken = vec![b'a', 0xff, b'b'];
        assert_eq!(take_utf8(&mut broken), "a\u{fffd}b");
    }
}
