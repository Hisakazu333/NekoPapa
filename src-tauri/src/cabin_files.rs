//! A verified model exposes only the files named by its Cubism manifest.
use serde_json::Value;
use std::{
    collections::HashMap,
    fs,
    path::{Component, Path, PathBuf},
};
use tauri::http::{Request, Response};

const MAX_ASSET_BYTES: u64 = 256 * 1024 * 1024;

pub struct CabinFiles {
    pub mount: String,
    pub entry: String,
    pub identity: String,
    pub digest: String,
    files: HashMap<String, PathBuf>,
    _directory: tempfile::TempDir,
}

impl CabinFiles {
    pub fn install(
        data: &[u8],
        identity: String,
        digest: String,
        entries: &[String],
    ) -> Result<Self, String> {
        let (directory, path) = crate::cabin_archive::unpack(data, entries)?;
        let (entry, files) = load(&path)?;
        let mount = getrandom::u64()
            .map_err(|_| "无法准备模型资源。")?
            .to_string();
        Ok(Self {
            mount,
            entry,
            identity,
            digest,
            files,
            _directory: directory,
        })
    }

    #[cfg(target_os = "macos")]
    pub fn native_entry(&self) -> Result<(&Path, &str), String> {
        let root = self
            .files
            .get(&self.entry)
            .and_then(|path| path.parent())
            .ok_or("无法找到已校验的模型目录。")?;
        Ok((root, &self.entry))
    }

    #[cfg(target_os = "macos")]
    pub fn motion_groups(&self) -> Result<Vec<String>, String> {
        let (root, entry) = self.native_entry()?;
        let bytes = fs::read(root.join(entry)).map_err(|_| "无法读取已校验的模型入口。")?;
        let model: Value = serde_json::from_slice(&bytes).map_err(|_| "模型入口格式无效。")?;
        Ok(model["FileReferences"]["Motions"]
            .as_object()
            .into_iter()
            .flat_map(|groups| groups.iter())
            .filter(|(_, items)| items.as_array().is_some_and(|items| !items.is_empty()))
            .map(|(group, _)| group.clone())
            .collect())
    }

    pub fn response(&self, path: &str, request: &Request<Vec<u8>>) -> Option<Response<Vec<u8>>> {
        let (mount, encoded) = path.strip_prefix('/')?.split_once('/')?;
        if mount != self.mount {
            return None;
        }
        let name = percent_encoding::percent_decode_str(encoded)
            .decode_utf8()
            .ok()?;
        let file = self.files.get(name.as_ref())?;
        let mime = match file.extension()?.to_str()? {
            "json" => "application/json",
            "png" => "image/png",
            "webp" => "image/webp",
            "jpg" | "jpeg" => "image/jpeg",
            "mp3" => "audio/mpeg",
            "ogg" => "audio/ogg",
            "wav" => "audio/wav",
            _ => "application/octet-stream",
        };
        let mut builder = Response::builder()
            .header("Content-Type", mime)
            .header("Cache-Control", "no-store")
            .header("X-Content-Type-Options", "nosniff");
        if let Some(origin) = request.headers().get("Origin") {
            let value = origin.to_str().ok()?;
            if !matches!(
                value,
                "tauri://localhost" | "http://tauri.localhost" | "https://tauri.localhost"
            ) && !(cfg!(debug_assertions) && value == "http://127.0.0.1:1420")
            {
                return None;
            }
            builder = builder.header("Access-Control-Allow-Origin", origin);
        }
        builder.body(fs::read(file).ok()?).ok()
    }
}
fn references(doc: &Value) -> Result<Vec<&str>, String> {
    let files = doc
        .get("FileReferences")
        .and_then(Value::as_object)
        .ok_or("模型缺少 FileReferences。")?;
    let mut paths = vec![files
        .get("Moc")
        .and_then(Value::as_str)
        .ok_or("模型缺少 .moc3 文件。")?];
    let textures = files
        .get("Textures")
        .and_then(Value::as_array)
        .filter(|entries| !entries.is_empty())
        .ok_or("模型缺少贴图。")?;
    for texture in textures {
        paths.push(texture.as_str().ok_or("模型贴图路径无效。")?);
    }
    for key in ["Physics", "Pose", "UserData", "DisplayInfo"] {
        if let Some(value) = files.get(key) {
            paths.push(value.as_str().ok_or("模型引用路径无效。")?);
        }
    }
    if let Some(expressions) = files.get("Expressions").and_then(Value::as_array) {
        for expression in expressions {
            paths.push(expression["File"].as_str().ok_or("模型表情路径无效。")?);
        }
    }
    if let Some(groups) = files.get("Motions").and_then(Value::as_object) {
        for group in groups.values().filter_map(Value::as_array) {
            for motion in group {
                paths.push(motion["File"].as_str().ok_or("模型动作路径无效。")?);
                if let Some(sound) = motion["Sound"].as_str().filter(|sound| !sound.is_empty()) {
                    paths.push(sound);
                }
            }
        }
    }
    if paths.len() > 400 {
        return Err("模型引用的资源过多。".into());
    }
    Ok(paths)
}

fn model_asset(root: &Path, name: &str) -> Result<PathBuf, String> {
    let relative = Path::new(name);
    if name.is_empty()
        || name.contains(['\\', ':', '?', '#', '%'])
        || relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err("模型引用必须使用模型目录内的相对路径。".into());
    }
    if !matches!(
        relative.extension().and_then(|ext| ext.to_str()),
        Some("json" | "moc3" | "png" | "webp" | "jpg" | "jpeg" | "mp3" | "wav" | "ogg")
    ) {
        return Err("模型包含不支持的资源格式。".into());
    }
    let file =
        fs::canonicalize(root.join(relative)).map_err(|_| format!("模型缺少资源：{name}"))?;
    if !file.starts_with(root) {
        return Err("模型资源指向选定目录之外。".into());
    }
    let meta = fs::metadata(&file).map_err(|_| "无法读取模型资源。")?;
    if !meta.is_file() || meta.len() > MAX_ASSET_BYTES {
        return Err("模型资源无效或体积过大。".into());
    }
    Ok(file)
}

fn load(path: &Path) -> Result<(String, HashMap<String, PathBuf>), String> {
    let manifest = fs::canonicalize(path).map_err(|_| "找不到模型文件。请重新选择。")?;
    let entry = manifest
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| name.ends_with(".model3.json"))
        .ok_or("请选择 .model3.json 文件。")?
        .to_owned();
    let root = manifest
        .parent()
        .ok_or("找不到模型所在目录。")?
        .to_path_buf();
    let meta = fs::metadata(&manifest).map_err(|_| "无法读取模型。")?;
    if !meta.is_file() || meta.len() > 1_000_000 {
        return Err("模型入口文件无效。".into());
    }
    let data: Value = serde_json::from_slice(&fs::read(&manifest).map_err(|_| "无法读取模型。")?)
        .map_err(|_| "模型入口不是有效的 JSON。")?;
    if data["Version"].as_u64() != Some(3) {
        return Err("只支持 Cubism 3 及更新版本的模型入口。".into());
    }
    let mut files = HashMap::from([(entry.clone(), manifest.clone())]);
    for name in references(&data)? {
        files.insert(name.to_owned(), model_asset(&root, name)?);
    }
    Ok((entry, files))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn importer_loads_only_referenced_assets_and_refuses_an_escape() {
        let root = tempfile::tempdir().unwrap();
        let model = root.path().join("Mio.model3.json");
        for asset in ["model.moc3", "texture.png", "private.json"] {
            fs::write(root.path().join(asset), b"fixture").unwrap();
        }
        fs::write(
            &model,
            r#"{"Version":3,"FileReferences":{"Moc":"model.moc3","Textures":["texture.png"]}}"#,
        )
        .unwrap();
        let validated = load(&model).unwrap();
        assert_eq!(validated.1.len(), 3);
        assert!(!validated.1.contains_key("private.json"));
        fs::write(
            &model,
            r#"{"Version":3,"FileReferences":{"Moc":"../model.moc3","Textures":["texture.png"]}}"#,
        )
        .unwrap();
        assert!(load(&model).is_err());
    }
}
