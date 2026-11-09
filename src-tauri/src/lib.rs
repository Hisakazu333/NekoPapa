mod project_folder;

pub fn run() {
    tauri::Builder::default()
        // Native open dialog: project folders are chosen in the system folder
        // picker so the app receives the full path (see capabilities/main.json).
        .plugin(tauri_plugin_dialog::init())
        // Confirms a chosen or typed folder exists and reads its Git branch.
        .invoke_handler(tauri::generate_handler![project_folder::inspect_project_folder])
        .run(tauri::generate_context!())
        .expect("failed to run NekoPapa");
}
