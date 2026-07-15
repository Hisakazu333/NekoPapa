mod stage;

use std::sync::Arc;
use tauri::RunEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let stage = Arc::new(stage::StageSupervisor::default());
    let shutdown_stage = Arc::clone(&stage);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(stage)
        .invoke_handler(tauri::generate_handler![
            stage::stage_status,
            stage::start_stage,
            stage::stop_stage,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build OpenNeko Engine");

    app.run(move |_app_handle, event| {
        if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
            shutdown_stage.stop();
        }
    });
}
