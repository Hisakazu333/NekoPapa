// NekoPapa 桌面宿主入口。
// 当前为最小 host：只创建主窗口。Native Stage sidecar 的进程管理
// （启动/监督/协议）属后续 PR，见 doc/architecture/build-and-test-gates.md。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running NekoPapa application");
}
