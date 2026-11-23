//! 设置 → 编辑器与终端 → 外部编辑器: opens a project file from the 文件 and
//! 更改 panels in the chosen editor. The path must resolve inside the
//! project folder (symlinks included), and it is passed as one argument, so
//! it is never read by a shell. Nothing is installed; a missing editor is
//! reported as missing.

use crate::project_workspace::{inside, root_of};
use std::path::Path;
use std::process::Command;

/// macOS application names for each editor choice; JetBrains tries its IDEs in turn.
fn applications(editor: &str) -> Result<&'static [&'static str], String> {
    Ok(match editor {
        "system" => &[],
        "vscode" => &["Visual Studio Code"],
        "cursor" => &["Cursor"],
        "zed" => &["Zed"],
        "xcode" => &["Xcode"],
        "jetbrains" => &[
            "IntelliJ IDEA",
            "IntelliJ IDEA CE",
            "WebStorm",
            "PyCharm",
            "PyCharm CE",
            "GoLand",
            "RustRover",
            "CLion",
            "PhpStorm",
            "Rider",
        ],
        _ => return Err("未知的编辑器。".into()),
    })
}

fn launch(path: &Path, editor: &str) -> Result<(), String> {
    let apps = applications(editor)?;
    #[cfg(target_os = "macos")]
    {
        if apps.is_empty() {
            return run(Command::new("open").arg(path), "系统默认应用");
        }
        for app in apps {
            if Command::new("open")
                .args(["-Ra", app])
                .status()
                .is_ok_and(|s| s.success())
            {
                return run(Command::new("open").arg("-a").arg(app).arg(path), app);
            }
        }
        Err(format!(
            "没有找到 {}，请先安装，或在 设置 → 编辑器与终端 中换一个编辑器。",
            apps[0]
        ))
    }
    #[cfg(not(target_os = "macos"))]
    {
        if !apps.is_empty() {
            return Err("当前系统只支持用系统默认应用打开。".into());
        }
        #[cfg(target_os = "windows")]
        return run(Command::new("explorer").arg(path), "系统默认应用");
        #[cfg(not(target_os = "windows"))]
        return run(Command::new("xdg-open").arg(path), "系统默认应用");
    }
}

fn run(command: &mut Command, name: &str) -> Result<(), String> {
    match command.status() {
        Ok(status) if status.success() => Ok(()),
        _ => Err(format!("无法用 {name} 打开文件。")),
    }
}

#[tauri::command]
pub async fn open_in_editor(root: String, path: String, editor: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = root_of(&root)?;
        let file = inside(&root, &path)?;
        launch(&file, &editor)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::applications;

    #[test]
    fn knows_each_settings_choice_and_refuses_others() {
        for editor in ["system", "vscode", "cursor", "zed", "xcode", "jetbrains"] {
            assert!(applications(editor).is_ok(), "{editor}");
        }
        assert!(applications("rm -rf").is_err());
    }
}
