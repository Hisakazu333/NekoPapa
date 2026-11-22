//! Unpacks only regular files into a private, bounded temporary directory.
use std::{
    fs::{self, OpenOptions},
    io::{self, Cursor, Read},
    path::{Component, Path, PathBuf},
};

pub const MAX_DOWNLOAD: u64 = 180 * 1024 * 1024;
const MAX_UNPACKED: u64 = 512 * 1024 * 1024;

fn relative(name: &str) -> Option<&Path> {
    let path = Path::new(name);
    (!name.is_empty()
        && !name.contains(['\\', '\0', ':'])
        && name.split('/').all(|part| part != "." && part != "..")
        && path
            .components()
            .all(|part| matches!(part, Component::Normal(_))))
    .then_some(path)
}

pub fn unpack(
    data: &[u8],
    expected_entries: &[String],
) -> Result<(tempfile::TempDir, PathBuf), String> {
    let requested = expected_entries
        .iter()
        .map(|entry| relative(entry).ok_or("发布包的模型入口无效。"))
        .collect::<Result<Vec<_>, _>>()?;
    let destination = tempfile::Builder::new()
        .prefix("nekopapa-live2d-")
        .tempdir()
        .map_err(|_| "无法准备 Live2D 临时目录。")?;
    let mut archive =
        zip::ZipArchive::new(Cursor::new(data)).map_err(|_| "不是有效的 Live2D ZIP 文件。")?;
    if archive.len() > 2500 {
        return Err("ZIP 内的文件太多。".into());
    }
    let mut manifests = Vec::new();
    let mut remaining = MAX_UNPACKED;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|_| "无法读取 ZIP 条目。")?;
        // Some officially published ZIPs were written on Windows.
        // Validate the canonical path before joining it to the destination.
        let normalized = entry.name().replace('\\', "/");
        let name = normalized.trim_end_matches('/');
        let path = relative(name).ok_or("ZIP 中包含无效路径。")?.to_owned();
        if entry.is_symlink() || (!entry.is_file() && !entry.is_dir()) {
            return Err("ZIP 中只能包含普通文件和文件夹。".into());
        }
        if name
            .split('/')
            .any(|part| matches!(part, "__MACOSX" | ".DS_Store"))
        {
            continue;
        }
        let target = destination.path().join(&path);
        if entry.is_dir() {
            continue;
        }
        if entry.size() > remaining || entry.size() > 256 * 1024 * 1024 {
            return Err("模型解压后体积过大。".into());
        }
        fs::create_dir_all(target.parent().ok_or("模型文件路径无效。")?)
            .map_err(|_| "无法创建模型目录。")?;
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
            .map_err(|_| "ZIP 路径重复或无法写入。")?;
        let limit = entry.size();
        let copied = io::copy(&mut entry.by_ref().take(limit + 1), &mut output)
            .map_err(|_| "模型解压失败。")?;
        if copied != limit {
            return Err("ZIP 文件大小与内容不一致。".into());
        }
        remaining -= copied;
        if name_ends_in_model(&path) {
            manifests.push(path);
        }
    }
    let model = requested
        .iter()
        .find(|entry| manifests.iter().any(|path| path.as_path() == **entry))
        .ok_or("ZIP 缺少发布清单指定的模型入口。")?;
    let path = destination.path().join(model);
    Ok((destination, path))
}

fn name_ends_in_model(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.ends_with(".model3.json"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::{write::SimpleFileOptions, ZipWriter};

    fn archive(files: &[&str]) -> Vec<u8> {
        let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
        for path in files {
            zip.start_file(*path, SimpleFileOptions::default()).unwrap();
            zip.write_all(b"example").unwrap();
        }
        zip.finish().unwrap().into_inner()
    }

    #[test]
    fn selects_a_unique_model_or_the_exact_official_entry() {
        let data = archive(&[
            "release/runtime/mio.model3.json",
            "release/runtime/model.moc3",
        ]);
        let (temp, path) = unpack(
            &data,
            &[
                "legacy/runtime/mio.model3.json".into(),
                "release/runtime/mio.model3.json".into(),
            ],
        )
        .unwrap();
        assert_eq!(path, temp.path().join("release/runtime/mio.model3.json"));
        assert!(unpack(&data, &["other/runtime/mio.model3.json".into()]).is_err());
        assert!(unpack(
            &archive(&["a.model3.json", "b.model3.json"]),
            &["test.model3.json".into()]
        )
        .is_err());
    }

    #[test]
    fn refuses_zip_traversal_before_writing_any_external_file() {
        for path in [
            "../outside",
            "nested/../outside",
            "/absolute",
            "..\\outside",
            "\\absolute",
            "C:\\outside",
        ] {
            assert!(
                unpack(
                    &archive(&[path, "test.model3.json"]),
                    &["test.model3.json".into()]
                )
                .is_err(),
                "{path}"
            );
        }
    }

    #[test]
    fn reads_windows_entries_and_rejects_collisions_after_normalizing() {
        let model = "hiyori_pro_zh/runtime/hiyori_pro_t11.model3.json";
        let legacy_entry = model.replace('/', "\\");
        let archive_data = archive(&[&legacy_entry]);
        let (temp, manifest) = unpack(&archive_data, &[model.into()]).unwrap();
        assert_eq!(manifest, temp.path().join(model));
        assert!(unpack(&archive(&[&legacy_entry, model]), &[model.into()]).is_err());
    }
}
