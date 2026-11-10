mod browser_view;
mod local_models;
mod project_folder;

pub fn run() {
    tauri::Builder::default()
        // Native open dialog: project folders are chosen in the system folder
        // picker so the app receives the full path (see capabilities/main.json).
        .plugin(tauri_plugin_dialog::init())
        // Confirms a chosen or typed folder exists and reads its Git branch.
        // Built-in browser: a native child webview over the chat's browser area.
        .invoke_handler(tauri::generate_handler![
            project_folder::inspect_project_folder,
            local_models::probe_local_models,
            browser_view::browser_open,
            browser_view::browser_set_bounds,
            browser_view::browser_set_visible,
            browser_view::browser_command,
            browser_view::browser_set_zoom,
            browser_view::browser_pick,
            browser_view::browser_pick_result,
            browser_view::browser_close,
            browser_view::browser_open_window,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run NekoPapa");
}
