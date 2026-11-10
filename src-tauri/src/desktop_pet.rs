use crate::desktop_tools::{allowed, data_root, PET};
use percent_encoding::percent_decode_str;
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::{Component, Path, PathBuf},
    sync::Mutex,
};
use tauri::{
    http::{Request, Response},
    AppHandle, Manager, Runtime, UriSchemeContext, UriSchemeResponder, Webview, WebviewUrl,
    WebviewWindowBuilder,
};

const MAX_ASSET_BYTES: u64 = 256 * 1024 * 1024;

#[derive(Default)]
pub struct PetLibrary(Mutex<Option<PetAssets>>);

pub(crate) struct PetAssets {
    manifest: PathBuf,
    root: PathBuf,
    files: HashMap<String, PathBuf>,
    entry: String,
    motion: Option<String>,
    owner: Option<String>,
    temporary: Option<tempfile::TempDir>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetStatus {
    model_path: Option<String>,
    visible: bool,
    source: Option<&'static str>,
}

#[derive(Serialize)]
pub struct PetModel {
    url: String,
    motion: Option<String>,
}

fn preference<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(data_root(app)?.join("pet-model.json"))
}

fn saved_path<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    let path = preference(app).ok()?;
    if fs::metadata(&path).ok()?.len() > 24_000 {
        return None;
    }
    serde_json::from_slice(&fs::read(path).ok()?).ok()
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

fn load(path: &str) -> Result<PetAssets, String> {
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
    let motion = data["FileReferences"]["Motions"]
        .as_object()
        .and_then(|groups| {
            ["TapBody", "PetHead", "Wave", "Happy", "Nod"]
                .iter()
                .find(|group| {
                    groups
                        .get(**group)
                        .and_then(Value::as_array)
                        .is_some_and(|items| !items.is_empty())
                })
                .map(|group| group.to_string())
        });
    Ok(PetAssets {
        manifest,
        root,
        files,
        entry,
        motion,
        owner: None,
        temporary: None,
    })
}

pub(crate) fn load_temporary(
    temporary: tempfile::TempDir,
    path: &Path,
) -> Result<PetAssets, String> {
    let mut model = load(path.to_str().ok_or("模型入口路径无效。")?)?;
    model.temporary = Some(temporary);
    Ok(model)
}

fn persist(path: &Path, model: &Path) -> Result<(), String> {
    let parent = path.parent().ok_or("无法定位桌宠设置目录。")?;
    fs::create_dir_all(parent).map_err(|_| "无法创建桌宠设置目录。")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|_| "无法准备桌宠设置。")?;
    serde_json::to_writer(&mut temp, &model.to_string_lossy()).map_err(|_| "无法写入桌宠设置。")?;
    temp.flush().map_err(|_| "无法写入桌宠设置。")?;
    temp.as_file()
        .sync_all()
        .map_err(|_| "无法保存桌宠设置。")?;
    temp.persist(path).map_err(|_| "无法保存桌宠设置。")?;
    Ok(())
}

#[tauri::command]
pub async fn desktop_pet_status<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
) -> Result<PetStatus, String> {
    allowed(&view, &["main"])?;
    let library = app.state::<PetLibrary>();
    let state = library.0.lock().map_err(|_| "桌宠正忙。")?;
    let visible = app.get_webview_window(PET).is_some();
    Ok(PetStatus {
        model_path: saved_path(&app),
        visible,
        source: state.as_ref().filter(|_| visible).map(|model| {
            if model.owner.is_some() {
                "account"
            } else {
                "local"
            }
        }),
    })
}

#[tauri::command]
pub async fn desktop_pet_import<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
    path: String,
) -> Result<String, String> {
    allowed(&view, &["main"])?;
    let preference = preference(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let model = load(&path)?;
        persist(&preference, &model.manifest)?;
        Ok(model.manifest.to_string_lossy().into_owned())
    })
    .await
    .map_err(|_| "桌宠模型导入中断。")?
}

#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn neko_position_pet(window: *mut std::ffi::c_void);
}

#[tauri::command]
pub async fn desktop_pet_open<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
) -> Result<(), String> {
    allowed(&view, &["main"])?;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Err("桌宠窗口目前支持 macOS。".into())
    }
    #[cfg(target_os = "macos")]
    {
        let path = saved_path(&app).ok_or("请先选择本机 Live2D 模型。")?;
        let model = tauri::async_runtime::spawn_blocking(move || load(&path))
            .await
            .map_err(|_| "模型加载中断。")??;
        open_assets(&app, model, None)
    }
}

pub(crate) fn open_assets<R: Runtime>(
    app: &AppHandle<R>,
    mut model: PetAssets,
    owner: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if app.get_webview_window(PET).is_some() {
            return Err("请先关闭当前桌宠，再打开另一个模型。".into());
        }
        model.owner = owner;
        *app.state::<PetLibrary>()
            .0
            .lock()
            .map_err(|_| "桌宠正忙。")? = Some(model);
        let window = WebviewWindowBuilder::new(app, PET, WebviewUrl::App("index.html".into()))
            .title("NekoPapa 桌宠")
            .inner_size(240.0, 340.0)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .resizable(false)
            .shadow(false)
            .visible(false)
            .build()
            .map_err(|_| "无法创建桌宠窗口。")?;
        let for_ui = window.clone();
        window
            .run_on_main_thread(move || {
                if let Ok(handle) = for_ui.ns_window() {
                    unsafe { neko_position_pet(handle) };
                }
                let _ = for_ui.show();
            })
            .map_err(|_| "无法显示桌宠。".into())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, model, owner);
        Err("桌宠窗口目前支持 macOS。".into())
    }
}

pub(crate) fn close_account_pet<R: Runtime>(app: &AppHandle<R>) {
    let library = app.state::<PetLibrary>();
    let Ok(mut state) = library.0.lock() else {
        return;
    };
    if state.as_ref().is_some_and(|model| model.owner.is_some()) {
        *state = None;
        drop(state);
        if let Some(window) = app.get_webview_window(PET) {
            let _ = window.close();
        }
    }
}

pub(crate) fn release<R: Runtime>(app: &AppHandle<R>) {
    let library = app.state::<PetLibrary>();
    let Ok(mut state) = library.0.lock() else {
        return;
    };
    *state = None;
}

fn authorized<R: Runtime>(app: &AppHandle<R>, model: &PetAssets) -> bool {
    model.owner.as_deref().is_none_or(|owner| {
        crate::account_auth::models::session_matches(
            &app.state::<crate::account_auth::AccountAuth>(),
            owner,
        )
    })
}

#[tauri::command]
pub async fn desktop_pet_model<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
) -> Result<PetModel, String> {
    allowed(&view, &[PET])?;
    let library = app.state::<PetLibrary>();
    let state = library.0.lock().map_err(|_| "桌宠正忙。")?;
    let model = state
        .as_ref()
        .filter(|model| authorized(&app, model))
        .ok_or("当前没有可用的模型。")?;
    // Use URL path encoding so the renderer still recognizes the .model3.json suffix.
    let mut url = reqwest::Url::parse("nekopet://localhost/").expect("constant URL");
    url.path_segments_mut()
        .expect("hierarchical URL")
        .pop_if_empty()
        .push(&model.entry);
    Ok(PetModel {
        url: url.into(),
        motion: model.motion.clone(),
    })
}

pub fn serve_asset<R: Runtime>(
    context: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let allowed = context.webview_label() == PET && request.method() == tauri::http::Method::GET;
    let app = context.app_handle().clone();
    let path = request.uri().path().to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        responder.respond(asset_response(&app, allowed, &path))
    });
}

fn asset_response<R: Runtime>(app: &AppHandle<R>, allowed: bool, path: &str) -> Response<Vec<u8>> {
    let response = |status, mime, body| {
        Response::builder()
            .status(status)
            .header("Content-Type", mime)
            .header("Access-Control-Allow-Origin", "*")
            .header("Cache-Control", "no-store")
            .body(body)
            .expect("static response headers")
    };
    if !allowed {
        return response(403, "text/plain", Vec::new());
    }
    let Ok(relative) = percent_decode_str(path.trim_start_matches('/')).decode_utf8() else {
        return response(400, "text/plain", Vec::new());
    };
    let library = app.state::<PetLibrary>();
    let file = library.0.lock().ok().and_then(|state| {
        let model = state.as_ref().filter(|model| authorized(app, model))?;
        let file = model.files.get(relative.as_ref())?;
        let resolved = fs::canonicalize(file).ok()?;
        (resolved == *file && resolved.starts_with(&model.root)).then_some(resolved)
    });
    let Some(file) = file else {
        return response(404, "text/plain", Vec::new());
    };
    let mime = match file.extension().and_then(|ext| ext.to_str()) {
        Some("json") => "application/json",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("mp3") => "audio/mpeg",
        Some("wav") => "audio/wav",
        Some("ogg") => "audio/ogg",
        _ => "application/octet-stream",
    };
    use std::io::Read;
    let mut bytes = Vec::new();
    match fs::File::open(file)
        .and_then(|file| file.take(MAX_ASSET_BYTES + 1).read_to_end(&mut bytes))
    {
        Ok(size) if size as u64 <= MAX_ASSET_BYTES => response(200, mime, bytes),
        _ => response(404, "text/plain", Vec::new()),
    }
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
        let validated = load(model.to_str().unwrap()).unwrap();
        assert_eq!(validated.files.len(), 3);
        assert!(!validated.files.contains_key("private.json"));
        fs::write(
            &model,
            r#"{"Version":3,"FileReferences":{"Moc":"../model.moc3","Textures":["texture.png"]}}"#,
        )
        .unwrap();
        assert!(load(model.to_str().unwrap()).is_err());
    }
}
