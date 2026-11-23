//! The memory service, run by this host: NekoCairn's HTTP server
//! (`nekocairn-server`) as a child process on a free local port, started the
//! first time the memory page asks for a space and stopped when the app
//! exits. Its data is `<appData>/data/memory/memory.sqlite`; its log is
//! `<appData>/logs/memory-server.log`. Each memory space (公共记忆, or one
//! person's) has its own random token, made at start and passed only in the
//! child's environment; asking for a space it was not started with restarts
//! it with that space added. The window never sees a token.
//!
//! NekoCairn is a Python package. The host uses the copy it installed in
//! `<appData>/data/memory/runtime` (a virtual environment, made from a wheel
//! the user picks), else a `nekocairn-server` on the login shell's PATH.
//! Without either the page shows that memory is not installed.

use crate::memory_config::{check_operation, check_scope, read_reply, service_config, token_env};
use serde::Serialize;
use serde_json::{json, Value};
use std::fs::{self, File};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};
use tauri::async_runtime::Mutex;
use tauri::{AppHandle, Runtime, State};

const READY_TIMEOUT: Duration = Duration::from_secs(30);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const LOG_TAIL: usize = 800;

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStatus {
    /// A `nekocairn-server` the host can start.
    installed: bool,
    /// It is the copy installed in the app's own environment.
    managed: bool,
    running: bool,
    executable: Option<String>,
}

struct Running {
    child: Child,
    port: u16,
    scopes: Vec<String>,
    tokens: Vec<String>,
}

#[derive(Default)]
pub struct MemoryService(Mutex<Option<Running>>);

impl MemoryService {
    /// Ends the server; called when the app exits.
    pub fn stop_now(&self) {
        if let Ok(mut running) = self.0.try_lock() {
            if let Some(mut service) = running.take() {
                let _ = service.child.kill();
                let _ = service.child.wait();
            }
        }
    }
}

fn memory_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = crate::app_data::root_of(app)?.join("data").join("memory");
    fs::create_dir_all(&dir).map_err(|_| "无法创建记忆数据文件夹。".to_string())?;
    Ok(dir)
}

fn runtime_bin(dir: &Path, name: &str) -> PathBuf {
    if cfg!(windows) {
        dir.join("runtime")
            .join("Scripts")
            .join(format!("{name}.exe"))
    } else {
        dir.join("runtime").join("bin").join(name)
    }
}

/// Runs `script` in the login shell (so PATH matches the user's terminal), with `args` as $1, $2…
fn login(script: &str, args: &[&str]) -> Command {
    #[cfg(unix)]
    {
        let shell = std::env::var("SHELL")
            .ok()
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "/bin/sh".into());
        let mut command = Command::new(shell);
        command.arg("-lc").arg(script).arg("nekopapa").args(args);
        command
    }
    #[cfg(windows)]
    {
        let mut command = Command::new("cmd");
        command.arg("/C").arg(script).args(args);
        command
    }
}

/// The server to start, and whether it is the app's own copy.
fn find_server(dir: &Path) -> Option<(PathBuf, bool)> {
    let managed = runtime_bin(dir, "nekocairn-server");
    if managed.is_file() {
        return Some((managed, true));
    }
    let output = login("command -v nekocairn-server", &[])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    let found = String::from_utf8_lossy(&output.stdout)
        .lines()
        .last()?
        .trim()
        .to_string();
    (output.status.success() && Path::new(&found).is_file()).then(|| (PathBuf::from(found), false))
}

fn status_of(dir: &Path, running: bool) -> MemoryStatus {
    let found = find_server(dir);
    MemoryStatus {
        installed: found.is_some(),
        managed: found.as_ref().is_some_and(|(_, managed)| *managed),
        running,
        executable: found.map(|(path, _)| path.display().to_string()),
    }
}

fn tail(text: &str) -> String {
    let text = text.trim();
    let start = text
        .char_indices()
        .rev()
        .nth(LOG_TAIL)
        .map_or(0, |(index, _)| index);
    text[start..].to_string()
}

fn run_step(mut command: Command, what: &str) -> Result<(), String> {
    let output = command
        .stdin(Stdio::null())
        .output()
        .map_err(|_| format!("无法{what}。"))?;
    if output.status.success() {
        return Ok(());
    }
    Err(format!(
        "{what}失败：{}",
        tail(&String::from_utf8_lossy(&output.stderr))
    ))
}

fn random_token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|_| "无法生成记忆服务的凭据。".to_string())?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn free_port() -> Result<u16, String> {
    let listener =
        TcpListener::bind("127.0.0.1:0").map_err(|_| "没有可用的本机端口。".to_string())?;
    listener
        .local_addr()
        .map(|address| address.port())
        .map_err(|_| "没有可用的本机端口。".to_string())
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .no_proxy()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|_| "无法创建记忆服务连接。".to_string())
}

/// Starts the server for `scopes` and waits until it answers /health/ready.
async fn start(dir: PathBuf, logs: PathBuf, scopes: Vec<String>) -> Result<Running, String> {
    let lookup = dir.clone();
    let found = tauri::async_runtime::spawn_blocking(move || find_server(&lookup))
        .await
        .map_err(|e| e.to_string())?;
    let (server, _) = found.ok_or("没有安装记忆服务（NekoCairn）。")?;
    let database = dir.join("memory.sqlite");
    if !database.exists() {
        let mut init = Command::new(server.with_file_name(if cfg!(windows) {
            "nekocairn.exe"
        } else {
            "nekocairn"
        }));
        init.arg("init").arg(&database);
        tauri::async_runtime::spawn_blocking(move || run_step(init, "初始化记忆数据库"))
            .await
            .map_err(|_| "初始化记忆数据库中断。".to_string())??;
    }
    let config = dir.join("service.config.json");
    let text =
        serde_json::to_string_pretty(&service_config(&database.display().to_string(), &scopes)?)
            .map_err(|e| e.to_string())?;
    fs::write(&config, text).map_err(|_| "无法写入记忆服务配置。".to_string())?;
    let tokens = scopes
        .iter()
        .map(|_| random_token())
        .collect::<Result<Vec<_>, _>>()?;
    let port = free_port()?;
    fs::create_dir_all(&logs).map_err(|_| "无法创建日志文件夹。".to_string())?;
    let log_path = logs.join("memory-server.log");
    let log = File::create(&log_path).map_err(|_| "无法写入记忆服务日志。".to_string())?;
    let mut command = Command::new(&server);
    command
        .arg("--config")
        .arg(&config)
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(port.to_string())
        .stdin(Stdio::null())
        .stdout(log.try_clone().map_err(|e| e.to_string())?)
        .stderr(log);
    for (index, token) in tokens.iter().enumerate() {
        command.env(token_env(index), token);
    }
    let mut child = command
        .spawn()
        .map_err(|_| "无法启动记忆服务。".to_string())?;

    let http = client()?;
    let started = Instant::now();
    loop {
        if let Ok(Some(_)) = child.try_wait() {
            return Err(format!(
                "记忆服务启动失败：{}",
                tail(&fs::read_to_string(&log_path).unwrap_or_default())
            ));
        }
        let ready = http
            .get(format!("http://127.0.0.1:{port}/health/ready"))
            .send()
            .await;
        if ready.is_ok_and(|response| response.status().is_success()) {
            break;
        }
        if started.elapsed() > READY_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!(
                "记忆服务在 30 秒内没有就绪：{}",
                tail(&fs::read_to_string(&log_path).unwrap_or_default())
            ));
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    Ok(Running {
        child,
        port,
        scopes,
        tokens,
    })
}

#[tauri::command]
pub async fn memory_status<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, MemoryService>,
) -> Result<MemoryStatus, String> {
    let dir = memory_dir(&app)?;
    let running = state
        .0
        .lock()
        .await
        .as_mut()
        .is_some_and(|service| matches!(service.child.try_wait(), Ok(None)));
    tauri::async_runtime::spawn_blocking(move || status_of(&dir, running))
        .await
        .map_err(|e| e.to_string())
}

/// Installs NekoCairn (with its server) from a wheel into the app's own environment.
#[tauri::command]
pub async fn memory_install<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, MemoryService>,
    wheel: String,
) -> Result<MemoryStatus, String> {
    let path = PathBuf::from(&wheel);
    if !path.is_file() || path.extension().and_then(|e| e.to_str()) != Some("whl") {
        return Err("请选择 NekoCairn 的 .whl 安装包。".into());
    }
    let dir = memory_dir(&app)?;
    let mut running = state.0.lock().await;
    if let Some(mut service) = running.take() {
        let _ = service.child.kill();
        let _ = service.child.wait();
    }
    let runtime = dir.join("runtime");
    let target = runtime.display().to_string();
    let python = runtime_bin(&dir, "python");
    let requirement = format!("{}[server]", path.display());
    tauri::async_runtime::spawn_blocking(move || {
        let check = "python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'";
        run_step(login(check, &[]), "找到 Python 3.10 或更新版本")?;
        run_step(
            login("python3 -m venv \"$1\"", &[&target]),
            "创建记忆服务的 Python 环境",
        )?;
        let mut install = Command::new(&python);
        install
            .args([
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--upgrade",
            ])
            .arg(&requirement);
        run_step(install, "安装 NekoCairn")?;
        Ok::<_, String>(status_of(&dir, false))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// One NekoCairn operation in one memory space; returns the operation's `result`.
#[tauri::command]
pub async fn memory_invoke<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, MemoryService>,
    scope: String,
    operation: String,
    params: Value,
) -> Result<Value, String> {
    check_scope(&scope)?;
    check_operation(&operation)?;
    if !params.is_object() {
        return Err("记忆操作的参数必须是对象。".into());
    }
    let (port, token) = {
        let mut running = state.0.lock().await;
        let alive = running
            .as_mut()
            .is_some_and(|service| matches!(service.child.try_wait(), Ok(None)));
        let known = running
            .as_ref()
            .and_then(|service| service.scopes.iter().position(|each| *each == scope));
        if !alive || known.is_none() {
            let mut scopes = running
                .as_ref()
                .filter(|_| alive)
                .map(|service| service.scopes.clone())
                .unwrap_or_default();
            if !scopes.contains(&scope) {
                scopes.push(scope.clone());
            }
            if let Some(mut old) = running.take() {
                let _ = old.child.kill();
                let _ = old.child.wait();
            }
            let logs = crate::app_data::root_of(&app)?.join("logs");
            *running = Some(start(memory_dir(&app)?, logs, scopes).await?);
        }
        let service = running.as_ref().ok_or("记忆服务没有运行。")?;
        let index = service
            .scopes
            .iter()
            .position(|each| *each == scope)
            .ok_or("记忆空间没有启动。")?;
        (service.port, service.tokens[index].clone())
    };
    let response = client()?
        .post(format!("http://127.0.0.1:{port}/v1/invoke"))
        .bearer_auth(token)
        .json(&json!({ "version": 1, "operation": operation, "params": params }))
        .send()
        .await
        .map_err(|_| "无法连接记忆服务。".to_string())?;
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|_| "记忆服务的回复中断了。".to_string())?;
    read_reply(status, &body)
}

#[cfg(test)]
#[path = "memory_service_tests.rs"]
mod tests;
