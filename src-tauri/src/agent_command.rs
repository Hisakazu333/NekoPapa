//! Shell commands the chat Agent runs in a project folder, after the user
//! approved them (or the chat's permission mode allows it). Each command runs
//! in the user's login shell so PATH matches their terminal, with no input,
//! in its own process group so a timeout or Stop ends everything it started.
//! Output is kept up to a limit per stream; the rest is drained and dropped.

use crate::project_workspace::root_of;
use serde::Serialize;
use std::collections::HashMap;
use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::State;

const MAX_OUTPUT: usize = 64 * 1024;
const MAX_COMMAND: usize = 8 * 1024;
const MAX_TIMEOUT: u64 = 600;

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
    timed_out: bool,
    cancelled: bool,
    truncated: bool,
    duration_ms: u64,
}

/// Running commands by the id the window gave them, so Stop can end one.
#[derive(Default)]
pub struct AgentCommands(Mutex<HashMap<u32, Arc<Mutex<Option<u32>>>>>);

fn shell(command: &str) -> Command {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        let login = std::env::var("SHELL").ok().filter(|value| !value.is_empty()).unwrap_or_else(|| "/bin/sh".into());
        let mut process = Command::new(login);
        process.arg("-l").arg("-c").arg(command).process_group(0);
        process
    }
    #[cfg(windows)]
    {
        let mut process = Command::new("cmd");
        process.arg("/C").arg(command);
        process
    }
}

fn kill(child_pid: u32) {
    #[cfg(unix)]
    let _ = Command::new("kill").arg("-KILL").arg(format!("-{child_pid}")).status();
    #[cfg(windows)]
    let _ = Command::new("taskkill").args(["/T", "/F", "/PID", &child_pid.to_string()]).status();
}

fn collect(mut stream: impl Read + Send + 'static) -> thread::JoinHandle<(Vec<u8>, bool)> {
    thread::spawn(move || {
        let (mut kept, mut buffer, mut cut) = (Vec::new(), [0u8; 8192], false);
        while let Ok(count) = stream.read(&mut buffer) {
            if count == 0 {
                break;
            }
            let room = MAX_OUTPUT.saturating_sub(kept.len());
            kept.extend_from_slice(&buffer[..count.min(room)]);
            cut |= count > room;
        }
        (kept, cut)
    })
}

fn wait(child: &mut Child, deadline: Instant, cancelled: &Mutex<Option<u32>>) -> (Option<i32>, bool, bool) {
    loop {
        if let Ok(Some(status)) = child.try_wait() {
            return (status.code(), false, false);
        }
        let stopped = cancelled.lock().map(|pid| pid.is_none()).unwrap_or(false);
        if stopped || Instant::now() >= deadline {
            kill(child.id());
            let _ = child.wait();
            return (None, !stopped, stopped);
        }
        thread::sleep(Duration::from_millis(25));
    }
}

/// Runs `command` in `root`. `slot` holds the process id while it runs; Stop clears it.
pub fn run(root: &str, command: &str, timeout: Duration, slot: Arc<Mutex<Option<u32>>>) -> Result<CommandResult, String> {
    if command.trim().is_empty() || command.len() > MAX_COMMAND {
        return Err("命令为空或太长。".into());
    }
    let root = root_of(root)?;
    let started = Instant::now();
    let mut child = shell(command)
        .current_dir(&root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "无法启动命令行。".to_string())?;
    // Stop pressed before the start leaves the slot empty; wait() then ends it at once.
    if let Ok(mut pid) = slot.lock() {
        if pid.is_some() {
            *pid = Some(child.id());
        }
    }
    let stdout = collect(child.stdout.take().expect("piped"));
    let stderr = collect(child.stderr.take().expect("piped"));
    let (exit_code, timed_out, cancelled) = wait(&mut child, started + timeout, &slot);
    let (out, out_cut) = stdout.join().unwrap_or_default();
    let (err, err_cut) = stderr.join().unwrap_or_default();
    Ok(CommandResult {
        exit_code,
        stdout: String::from_utf8_lossy(&out).into_owned(),
        stderr: String::from_utf8_lossy(&err).into_owned(),
        timed_out,
        cancelled,
        truncated: out_cut || err_cut,
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

#[tauri::command]
pub async fn agent_run_command(commands: State<'_, AgentCommands>, id: u32, root: String, command: String, timeout: Option<u64>) -> Result<CommandResult, String> {
    // The slot starts as Some(0) ("starting"); Stop sets it to None.
    let slot = Arc::new(Mutex::new(Some(0)));
    commands.0.lock().map_err(|_| "命令状态不可用。".to_string())?.insert(id, slot.clone());
    let seconds = timeout.unwrap_or(120).clamp(1, MAX_TIMEOUT);
    let job = slot.clone();
    let result = tauri::async_runtime::spawn_blocking(move || run(&root, &command, Duration::from_secs(seconds), job))
        .await
        .map_err(|error| error.to_string())?;
    if let Ok(mut running) = commands.0.lock() {
        running.remove(&id);
    }
    result
}

#[tauri::command]
pub fn agent_cancel_command(commands: State<'_, AgentCommands>, id: u32) {
    if let Some(slot) = commands.0.lock().ok().and_then(|running| running.get(&id).cloned()) {
        if let Ok(mut pid) = slot.lock() {
            *pid = None;
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    fn root() -> String {
        std::env::temp_dir().to_string_lossy().into_owned()
    }

    #[test]
    fn captures_output_and_exit_code() {
        let result = run(&root(), "echo hello; echo oops 1>&2; exit 3", Duration::from_secs(20), Arc::new(Mutex::new(Some(0)))).unwrap();
        assert_eq!(result.exit_code, Some(3));
        assert!(result.stdout.contains("hello"));
        assert!(result.stderr.contains("oops"));
        assert!(!result.timed_out && !result.cancelled);
    }

    #[test]
    fn stops_at_the_timeout_and_when_cancelled() {
        let timed = run(&root(), "sleep 30", Duration::from_millis(300), Arc::new(Mutex::new(Some(0)))).unwrap();
        assert!(timed.timed_out);
        assert_eq!(timed.exit_code, None);
        let slot = Arc::new(Mutex::new(Some(0)));
        let cancel = slot.clone();
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(300));
            *cancel.lock().unwrap() = None;
        });
        let stopped = run(&root(), "sleep 30", Duration::from_secs(20), slot).unwrap();
        assert!(stopped.cancelled && !stopped.timed_out);
        assert!(stopped.duration_ms < 10_000);
    }

    #[test]
    fn keeps_only_the_first_part_of_long_output() {
        let result = run(&root(), "head -c 200000 /dev/zero | tr '\\0' 'a'", Duration::from_secs(20), Arc::new(Mutex::new(Some(0)))).unwrap();
        assert_eq!(result.stdout.len(), MAX_OUTPUT);
        assert!(result.truncated);
        assert!(run(&root(), "  ", Duration::from_secs(1), Arc::new(Mutex::new(Some(0)))).is_err());
    }
}
