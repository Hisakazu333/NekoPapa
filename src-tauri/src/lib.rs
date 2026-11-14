mod account_auth;
mod agent_command;
mod agent_diff;
mod agent_tools;
mod app_data;
mod chat_db;
mod browser_view;
mod editor_open;
mod external_link;
mod local_models;
mod memory_config;
mod memory_service;
mod credential_store;
mod model_proxy;
mod plugin_frame;
mod plugin_manifest;
mod project_files;
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
        .manage(app_data::AppDataState::default())
        .manage(agent_command::AgentCommands::default())
        // The local memory service (NekoCairn), started on first use.
        .manage(memory_service::MemoryService::default())
        // Interface plugins' frame views: static files of allowed plugin folders.
        .manage(plugin_frame::PluginFrames::default())
        .register_asynchronous_uri_scheme_protocol(plugin_frame::SCHEME, |ctx, request, responder| {
            plugin_frame::handle(ctx.app_handle(), request, responder)
        })
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
            // NekoPapa's own folder: chat history files, cache, 设置 → 数据.
            app_data::app_data_read,
            app_data::app_data_write,
            app_data::app_data_search,
            app_data::app_data_info,
            app_data::app_data_clear_cache,
            app_data::app_data_open,
            project_folder::inspect_project_folder,
            local_models::probe_local_models,
            // Read-only project views for the files and changes panels.
            project_workspace::project_list_dir,
            project_workspace::project_read_file,
            project_workspace::project_git_status,
            project_workspace::project_git_diff,
            project_files::agent_search,
            project_files::project_list_files,
            agent_tools::agent_write_file,
            agent_tools::agent_edit_file,
            agent_tools::agent_snapshot_state,
            agent_tools::agent_undo,
            agent_command::agent_run_command,
            agent_command::agent_cancel_command,
            // 设置 → 编辑器与终端 → 外部编辑器.
            editor_open::open_in_editor,
            // 设置 → 技能: lists skill folders already on this computer.
            skill_discovery::scan_skill_folders,
            // 设置 → 界面插件: reads one plugin's nekopapa-plugin.json, nothing else.
            plugin_manifest::plugin_manifest_read,
            // Which plugin folders the nekopapa-plugin:// scheme may serve.
            plugin_frame::plugin_frame_allow,
            plugin_frame::plugin_frame_revoke,
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
            // 对话 → 记忆: the memory service this host runs; tokens stay on this side.
            memory_service::memory_status,
            memory_service::memory_install,
            memory_service::memory_invoke,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build NekoPapa")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                use tauri::Manager;
                app.state::<memory_service::MemoryService>().stop_now();
            }
        });
}
