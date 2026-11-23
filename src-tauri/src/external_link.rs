//! Opens a web address in the system's default browser (for links such as
//! "在 GitHub 搜索插件"), instead of inside the app window. Only absolute
//! http(s) URLs are accepted, and the address is passed as one argument, so
//! it is never interpreted by a shell.

use crate::browser_view::parse_web_url;
use std::process::Command;

fn opener(url: &str) -> Command {
    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        command.arg(url);
        command
    }
    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("rundll32");
        command.args(["url.dll,FileProtocolHandler", url]);
        command
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let mut command = Command::new("xdg-open");
        command.arg(url);
        command
    }
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    let url = parse_web_url(&url)?;
    let status = opener(url.as_str())
        .status()
        .map_err(|_| "无法打开系统浏览器。".to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("无法打开系统浏览器。".to_string())
    }
}
