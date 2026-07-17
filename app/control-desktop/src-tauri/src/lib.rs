mod stage;
mod window_state;

use std::sync::Arc;
use tauri::{Manager, RunEvent, WindowEvent};

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
        .setup(|app| {
            window_state::restore_main_window(app.handle());
            if let Some(window) = app.get_webview_window("main") {
                window.show()?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build NekoPapa");

    app.run(move |app_handle, event| {
        let should_save_window = matches!(
            &event,
            RunEvent::WindowEvent {
                label,
                event: WindowEvent::CloseRequested { .. },
                ..
            } if label == "main"
        ) || matches!(event, RunEvent::ExitRequested { .. });

        if should_save_window {
            window_state::save_main_window(app_handle);
        }

        if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
            shutdown_stage.stop();
        }
    });
}
