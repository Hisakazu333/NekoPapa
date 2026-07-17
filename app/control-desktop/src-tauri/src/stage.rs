use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::{
    ShellExt,
    process::{CommandChild, CommandEvent},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StageStatus {
    state: &'static str,
    running: bool,
    pid: Option<u32>,
    message: String,
    mode: &'static str,
}

#[derive(Default)]
pub struct StageSupervisor {
    child: Mutex<Option<CommandChild>>,
    message: Mutex<String>,
}

impl StageSupervisor {
    fn status(&self) -> StageStatus {
        let child = self.child.lock().expect("stage child mutex poisoned");
        let running = child.is_some();
        let pid = child.as_ref().map(CommandChild::pid);
        let message = self
            .message
            .lock()
            .expect("stage message mutex poisoned")
            .clone();
        StageStatus {
            state: if running { "running" } else { "stopped" },
            running,
            pid,
            message: if message.is_empty() {
                if running {
                    "原生桌宠舞台运行中"
                } else {
                    "原生桌宠舞台已停止"
                }
                .to_string()
            } else {
                message
            },
            mode: "native-sidecar",
        }
    }

    fn clear_if_pid(&self, pid: u32, message: String) {
        let mut child = self.child.lock().expect("stage child mutex poisoned");
        if child.as_ref().map(CommandChild::pid) == Some(pid) {
            *child = None;
            *self.message.lock().expect("stage message mutex poisoned") = message;
        }
    }

    pub fn stop(&self) {
        let child = self
            .child
            .lock()
            .expect("stage child mutex poisoned")
            .take();
        if let Some(mut child) = child {
            let _ = child.write(b"{\"command\":\"shutdown\"}\n");
            std::thread::sleep(Duration::from_millis(120));
            let _ = child.kill();
        }
        *self.message.lock().expect("stage message mutex poisoned") =
            "原生桌宠舞台已停止".to_string();
    }
}

fn resolve_model_path(app: &AppHandle) -> Result<PathBuf, String> {
    let relative = PathBuf::from("assets/live2d/hiyori/hiyori_pro_t11.model3.json");
    let bundled = app
        .path()
        .resource_dir()
        .map_err(|error| format!("cannot resolve resource directory: {error}"))?
        .join(&relative);
    if bundled.is_file() {
        return Ok(bundled);
    }

    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../")
        .join(&relative);
    if development.is_file() {
        return Ok(development);
    }

    Err(format!("Live2D model is missing: {}", bundled.display()))
}

#[tauri::command]
pub fn stage_status(stage: State<'_, Arc<StageSupervisor>>) -> StageStatus {
    stage.status()
}

#[tauri::command]
pub fn start_stage(
    app: AppHandle,
    stage: State<'_, Arc<StageSupervisor>>,
) -> Result<StageStatus, String> {
    {
        let child = stage
            .child
            .lock()
            .map_err(|_| "stage child mutex poisoned")?;
        if child.is_some() {
            return Ok(stage.status());
        }
    }

    let model_path = resolve_model_path(&app)?;
    let model_argument = model_path.to_string_lossy().into_owned();
    let command = app
        .shell()
        .sidecar("openneko-live2d-stage")
        .map_err(|error| format!("cannot resolve Native Stage sidecar: {error}"))?
        .args(["--model", model_argument.as_str()]);
    let (mut receiver, child) = command
        .spawn()
        .map_err(|error| format!("cannot start Native Stage: {error}"))?;
    let pid = child.pid();

    *stage
        .child
        .lock()
        .map_err(|_| "stage child mutex poisoned")? = Some(child);
    *stage
        .message
        .lock()
        .map_err(|_| "stage message mutex poisoned")? = "原生桌宠舞台正在初始化".to_string();

    let supervisor = Arc::clone(stage.inner());
    let event_app = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = receiver.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).trim().to_string();
                    if !line.is_empty() {
                        let _ = event_app.emit("stage-protocol", line.clone());
                        *supervisor
                            .message
                            .lock()
                            .expect("stage message mutex poisoned") = line;
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let line = String::from_utf8_lossy(&bytes).trim().to_string();
                    if !line.is_empty() {
                        let _ = event_app.emit("stage-log", line);
                    }
                }
                CommandEvent::Terminated(payload) => {
                    supervisor.clear_if_pid(
                        pid,
                        format!("原生桌宠舞台已退出（code={:?}）", payload.code),
                    );
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(stage.status())
}

#[tauri::command]
pub fn stop_stage(stage: State<'_, Arc<StageSupervisor>>) -> StageStatus {
    stage.stop();
    stage.status()
}
