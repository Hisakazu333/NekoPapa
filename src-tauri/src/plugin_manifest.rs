//! Reads an interface plugin's manifest (`nekopapa-plugin.json`) from a
//! folder the user chose in 设置 → 界面插件. Only that one file is read, and
//! only as text: nothing in the folder is executed, listed or written. The
//! file must sit directly in the folder (a symlink pointing elsewhere is
//! refused) and stay under 256 KB. The front end checks the contents
//! (src/app/plugins/plugin-manifest.ts). The browser preview mirrors this in
//! scripts/plugin-manifest-api.ts.

use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

pub const MANIFEST_FILE: &str = "nekopapa-plugin.json";
const MAX_MANIFEST: u64 = 256 * 1024;

#[derive(Serialize, Debug, PartialEq)]
pub struct ManifestFile {
    /// The folder as resolved on disk, stored with the plugin.
    pub(crate) folder: String,
    pub(crate) text: String,
}

pub fn read_manifest(folder: &str) -> Result<ManifestFile, String> {
    let path = PathBuf::from(folder);
    if !path.is_absolute() {
        return Err("插件文件夹必须是完整路径。".into());
    }
    let root = fs::canonicalize(&path).map_err(|_| "插件文件夹不存在或无法访问。".to_string())?;
    if !root.is_dir() {
        return Err("所选路径不是文件夹。".into());
    }
    let manifest = root.join(MANIFEST_FILE);
    let resolved =
        fs::canonicalize(&manifest).map_err(|_| format!("文件夹里没有 {MANIFEST_FILE}。"))?;
    if resolved.parent() != Some(root.as_path()) {
        return Err(format!("{MANIFEST_FILE} 指向了文件夹以外的位置。"));
    }
    let meta = fs::metadata(&resolved).map_err(|_| format!("无法读取 {MANIFEST_FILE}。"))?;
    if !meta.is_file() {
        return Err(format!("{MANIFEST_FILE} 不是文件。"));
    }
    if meta.len() > MAX_MANIFEST {
        return Err(format!("{MANIFEST_FILE} 超过 256 KB。"));
    }
    let mut bytes = Vec::new();
    fs::File::open(&resolved)
        .and_then(|file| file.take(MAX_MANIFEST + 1).read_to_end(&mut bytes))
        .map_err(|_| format!("无法读取 {MANIFEST_FILE}。"))?;
    let text =
        String::from_utf8(bytes).map_err(|_| format!("{MANIFEST_FILE} 不是 UTF-8 文本。"))?;
    Ok(ManifestFile {
        folder: display(&root),
        text,
    })
}

fn display(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[tauri::command]
pub async fn plugin_manifest_read(folder: String) -> Result<ManifestFile, String> {
    tauri::async_runtime::spawn_blocking(move || read_manifest(&folder))
        .await
        .map_err(|_| "读取失败。".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "nekopapa-plugin-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn reads_the_manifest_as_text() {
        let dir = temp("ok");
        fs::write(dir.join(MANIFEST_FILE), "{\"id\":\"a.b\"}").unwrap();
        let file = read_manifest(&dir.to_string_lossy()).unwrap();
        assert_eq!(file.text, "{\"id\":\"a.b\"}");
        assert_eq!(PathBuf::from(&file.folder), fs::canonicalize(&dir).unwrap());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn refuses_relative_missing_and_non_folders() {
        assert!(read_manifest("plugins/a").unwrap_err().contains("完整路径"));
        let dir = temp("missing");
        assert!(read_manifest(&dir.to_string_lossy())
            .unwrap_err()
            .contains("没有"));
        fs::write(dir.join("file"), "x").unwrap();
        assert!(read_manifest(&dir.join("file").to_string_lossy())
            .unwrap_err()
            .contains("不是文件夹"));
        fs::create_dir(dir.join(MANIFEST_FILE)).unwrap();
        assert!(read_manifest(&dir.to_string_lossy())
            .unwrap_err()
            .contains("不是文件"));
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn refuses_large_and_non_utf8_files() {
        let dir = temp("size");
        fs::write(
            dir.join(MANIFEST_FILE),
            vec![b' '; (MAX_MANIFEST + 1) as usize],
        )
        .unwrap();
        assert!(read_manifest(&dir.to_string_lossy())
            .unwrap_err()
            .contains("256 KB"));
        fs::write(dir.join(MANIFEST_FILE), [0xff, 0xfe, 0x00]).unwrap();
        assert!(read_manifest(&dir.to_string_lossy())
            .unwrap_err()
            .contains("UTF-8"));
        fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn refuses_a_manifest_linked_from_outside() {
        let dir = temp("link");
        let outside = temp("outside");
        fs::write(outside.join("other.json"), "{}").unwrap();
        std::os::unix::fs::symlink(outside.join("other.json"), dir.join(MANIFEST_FILE)).unwrap();
        assert!(read_manifest(&dir.to_string_lossy())
            .unwrap_err()
            .contains("以外"));
        fs::remove_dir_all(dir).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }
}
