mod account_auth;
mod browser_view;
mod editor_open;
mod external_link;
mod local_models;
mod credential_store;
mod model_proxy;
mod project_folder;
mod project_workspace;
mod skill_discovery;
mod terminal;

pub fn run() {
    tauri::Builder::default()
        // Native open dialog: project folders are chosen in the system folder
        // picker so the app receives the full path (see capabilities/main.json).
        .plugin(tauri_plugin_dialog::init())
        // Terminal panel sessions (pseudo-terminals running the login shell).
        .manage(terminal::Terminals::default())
        .manage(account_auth::AccountAuth::default())
        // Confirms a chosen or typed folder exists and reads its Git branch.
        // Built-in browser: a native child webview over the chat's browser area.
        .invoke_handler(tauri::generate_handler![
            account_auth::account_snapshot,
            account_auth::account_send_code,
            account_auth::account_sign_in,
            account_auth::device::account_device_start,
            account_auth::device::account_device_poll,
            account_auth::account_cancel,
            account_auth::account_logout,
            project_folder::inspect_project_folder,
            local_models::probe_local_models,
            // Read-only project views for the files and changes panels.
            project_workspace::project_list_dir,
            project_workspace::project_read_file,
            project_workspace::project_git_status,
            project_workspace::project_git_diff,
            // 设置 → 编辑器与终端 → 外部编辑器.
            editor_open::open_in_editor,
            // 设置 → 技能: lists skill folders already on this computer.
            skill_discovery::scan_skill_folders,
            // Links that leave the app open in the system browser.
            external_link::open_external_url,
            terminal::terminal_open,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
            browser_view::browser_open,
            browser_view::browser_set_bounds,
            browser_view::browser_set_visible,
            browser_view::browser_command,
            browser_view::browser_set_zoom,
            browser_view::browser_pick,
            browser_view::browser_pick_result,
            browser_view::browser_close,
            browser_view::browser_open_window,
            // Desktop chat runtime: model requests with keys filled in on this side.
            model_proxy::chat_environment,
            credential_store::credential_set,
            credential_store::credential_delete,
            credential_store::credential_has,
            model_proxy::model_fetch,
            model_proxy::model_fetch_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run NekoPapa");
}
