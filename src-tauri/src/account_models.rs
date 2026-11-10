//! Authenticated companion model operations. Tokens and signed URLs stay in Rust.
use super::{decode_response, lock, main_view, request, AccountAuth, RequestFailure, Session};
use crate::{desktop_pet, pet_archive};
use reqwest::{multipart, Method, Url};
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{fs, io::Read, path::Path, time::Duration};
use tauri::{AppHandle, Runtime, State, Webview};

const ROSTER: &str = "/api/app/companion/roster";
const ROLES: &str = "/api/app/companion/custom-roles";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelChoice {
    id: String,
    name: String,
    current: bool,
}

struct RosterModel {
    choice: ModelChoice,
    official_ref: Option<String>,
    model_url: Option<String>,
}

fn roster_models(roster: Value) -> Vec<RosterModel> {
    roster["items"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|row| {
            let id = row["identityKey"].as_str()?;
            let reference = row["companionRef"].as_str()?;
            if reference.is_empty() || id.len() > 256 {
                return None;
            }
            let mode = row["companionMode"].as_str()?;
            if id != format!("{mode}:{reference}") {
                return None;
            }
            let official_ref = (mode == "OFFICIAL").then(|| reference.to_owned());
            let model_url = (mode == "ASSET"
                && row["modelResourceId"]
                    .as_str()
                    .is_some_and(|value| value.starts_with("user_model:")))
            .then(|| row["modelUrl"].as_str())
            .flatten()
            .filter(|url| !url.is_empty())
            .map(str::to_owned);
            if official_ref.is_none() && model_url.is_none() {
                return None;
            }
            let name = row["displayName"].as_str()?.trim();
            if name.is_empty() {
                return None;
            }
            Some(RosterModel {
                choice: ModelChoice {
                    id: id.to_owned(),
                    name: name.chars().take(100).collect(),
                    current: row["isCurrent"].as_bool().unwrap_or(false),
                },
                official_ref,
                model_url,
            })
        })
        .collect()
}

fn session(auth: &AccountAuth) -> Result<Session, String> {
    lock(auth)?
        .session
        .clone()
        .ok_or("请先登录 NekoPapa 账号。".into())
}

pub(crate) fn session_matches(auth: &AccountAuth, owner: &str) -> bool {
    lock(auth).ok().is_some_and(|state| {
        state
            .session
            .as_ref()
            .is_some_and(|active| active.attempt == owner)
    })
}

fn require_session(auth: &AccountAuth, owner: &str) -> Result<(), String> {
    if session_matches(auth, owner) {
        Ok(())
    } else {
        Err("账号已切换，请重新操作。".into())
    }
}

async fn authed(
    auth: &AccountAuth,
    current: &Session,
    method: Method,
    path: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    require_session(auth, &current.attempt)?;
    let response = request(auth, method, path, body, Some(&current.token))
        .await
        .map_err(RequestFailure::message)?;
    require_session(auth, &current.attempt)?;
    Ok(response)
}

#[tauri::command]
pub async fn account_pet_models<R: Runtime>(
    view: Webview<R>,
    auth: State<'_, AccountAuth>,
) -> Result<Vec<ModelChoice>, String> {
    main_view(&view)?;
    let current = session(&auth)?;
    let roster = authed(&auth, &current, Method::GET, ROSTER, None).await?;
    Ok(roster_models(roster)
        .into_iter()
        .map(|row| row.choice)
        .collect())
}

fn download_address(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|_| "模型下载地址无效。")?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err("模型下载需要可信的 HTTPS 地址。".into());
    }
    Ok(url)
}

async fn download(url: Url, expected_size: Option<u64>) -> Result<Vec<u8>, String> {
    let maximum = expected_size.unwrap_or(pet_archive::MAX_DOWNLOAD);
    if maximum == 0 || maximum > pet_archive::MAX_DOWNLOAD {
        return Err("模型压缩包过大或为空。".into());
    }
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|_| "无法准备模型下载。")?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|_| "模型下载失败，请重试。")?;
    if !response.status().is_success() || response.content_length().is_some_and(|n| n > maximum) {
        return Err("模型下载地址不可用或文件过大，请刷新重试。".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "模型下载中断。")? {
        if bytes.len() as u64 + chunk.len() as u64 > maximum {
            return Err("模型压缩包超过允许的大小。".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    if bytes.is_empty() || expected_size.is_some_and(|size| size != bytes.len() as u64) {
        return Err("下载的模型大小与发布记录不一致。".into());
    }
    Ok(bytes)
}

#[tauri::command]
pub async fn account_pet_open<R: Runtime>(
    app: AppHandle<R>,
    view: Webview<R>,
    auth: State<'_, AccountAuth>,
    id: Option<String>,
) -> Result<(), String> {
    main_view(&view)?;
    let current = session(&auth)?;
    let roster = authed(&auth, &current, Method::GET, ROSTER, None).await?;
    let model = roster_models(roster)
        .into_iter()
        .find(|row| {
            id.as_ref()
                .map_or(row.choice.current, |id| *id == row.choice.id)
        })
        .ok_or("账号当前同伴没有可用的 Live2D 模型。")?;
    let (bytes, entry) = if let Some(reference) = model.official_ref {
        let query = url_query(&reference);
        let descriptor = authed(
            &auth,
            &current,
            Method::GET,
            &format!("/api/app/companion/live2d/download-url?{query}"),
            None,
        )
        .await?;
        let field = |key: &str| {
            descriptor[key]
                .as_str()
                .filter(|value| !value.is_empty())
                .ok_or("官方 Live2D 发布资料不完整。")
        };
        let expected = descriptor["archiveSizeBytes"]
            .as_u64()
            .ok_or("官方模型缺少包体大小。")?;
        let sha = field("archiveSha256")?
            .strip_prefix("sha256:")
            .unwrap_or(field("archiveSha256")?)
            .to_owned();
        let bytes = download(download_address(field("downloadUrl")?)?, Some(expected)).await?;
        if !format!("{:x}", Sha256::digest(&bytes)).eq_ignore_ascii_case(&sha) {
            return Err("官方模型校验失败，未打开桌宠。".into());
        }
        (
            bytes,
            Some((
                field("rootDir")?.to_owned(),
                field("model3Path")?.to_owned(),
            )),
        )
    } else {
        let address = model.model_url.ok_or("当前账号没有可下载的模型。")?;
        (download(download_address(&address)?, None).await?, None)
    };
    require_session(&auth, &current.attempt)?;
    let model = tauri::async_runtime::spawn_blocking(move || {
        let expected = entry
            .as_ref()
            .map(|(root, entry)| (root.as_str(), entry.as_str()));
        let (temporary, entry) = pet_archive::unpack(&bytes, expected)?;
        desktop_pet::load_temporary(temporary, &entry)
    })
    .await
    .map_err(|_| "账号模型加载中断。")??;
    require_session(&auth, &current.attempt)?;
    desktop_pet::open_assets(&app, model, Some(current.attempt))
}

fn url_query(reference: &str) -> String {
    format!(
        "companionRef={}",
        percent_encoding::utf8_percent_encode(reference, percent_encoding::NON_ALPHANUMERIC)
    )
}

fn read_upload(path: &Path) -> Result<Vec<u8>, String> {
    if path
        .extension()
        .is_none_or(|extension| !extension.eq_ignore_ascii_case("zip"))
    {
        return Err("请选择 Live2D ZIP 压缩包。".into());
    }
    let metadata = fs::metadata(path).map_err(|_| "找不到所选 ZIP。")?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > pet_archive::MAX_UPLOAD {
        return Err("请选择 80 MB 以内的 Live2D ZIP 压缩包。".into());
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .and_then(|file| {
            file.take(pet_archive::MAX_UPLOAD + 1)
                .read_to_end(&mut bytes)
        })
        .map_err(|_| "无法读取 ZIP。")?;
    if bytes.len() as u64 > pet_archive::MAX_UPLOAD {
        return Err("ZIP 超过 80 MB。".into());
    }
    let (temporary, entry) = pet_archive::unpack(&bytes, None)?;
    desktop_pet::load_temporary(temporary, &entry)?;
    Ok(bytes)
}

#[tauri::command]
pub async fn account_pet_upload<R: Runtime>(
    view: Webview<R>,
    auth: State<'_, AccountAuth>,
    path: String,
) -> Result<String, String> {
    main_view(&view)?;
    let current = session(&auth)?;
    let filename = Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("ZIP 文件名无效。")?
        .to_owned();
    let bytes = tauri::async_runtime::spawn_blocking(move || read_upload(Path::new(&path)))
        .await
        .map_err(|_| "模型检查中断。")??;
    require_session(&auth, &current.attempt)?;
    let (base, client) = auth.connection.as_ref().ok_or("尚未配置账号服务。")?;
    let part = multipart::Part::bytes(bytes)
        .file_name(filename)
        .mime_str("application/zip")
        .map_err(|_| "无法准备 ZIP 上传。")?;
    let response = client
        .post(format!(
            "{}{ROLES}/model-file",
            base.as_str().trim_end_matches('/')
        ))
        .timeout(Duration::from_secs(120))
        .bearer_auth(&current.token)
        .multipart(multipart::Form::new().part("file", part))
        .send()
        .await
        .map_err(|_| "模型上传失败，请检查网络后重试。")?;
    let data = decode_response(response)
        .await
        .map_err(RequestFailure::message)?;
    require_session(&auth, &current.attempt)?;
    let resource = data["modelResourceId"]
        .as_str()
        .filter(|value| own_upload(&current, value))
        .ok_or("上传回执缺少模型标识。")?;
    Ok(resource.to_owned())
}

fn own_upload(session: &Session, id: &str) -> bool {
    id.strip_prefix(&format!(
        "user_model:user_model_u{}_",
        session.profile.user_id
    ))
    .is_some_and(|suffix| suffix.len() == 32 && suffix.bytes().all(|byte| byte.is_ascii_hexdigit()))
}

#[tauri::command]
pub async fn account_pet_bind<R: Runtime>(
    view: Webview<R>,
    auth: State<'_, AccountAuth>,
    resource: String,
    name: String,
) -> Result<(), String> {
    main_view(&view)?;
    let current = session(&auth)?;
    let name = name.trim();
    if name.is_empty() || name.encode_utf16().count() > 80 {
        return Err("请输入 1–80 字的同伴名称。".into());
    }
    if !own_upload(&current, &resource) {
        return Err("模型上传记录不属于当前账号。".into());
    }
    authed(
        &auth,
        &current,
        Method::POST,
        ROLES,
        Some(json!({ "name": name, "modelResourceId": resource })),
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn projects_only_usable_account_choices_without_exposing_urls() {
        let rows = roster_models(json!({"items": [
            {"identityKey":"OFFICIAL:cat_001", "companionMode":"OFFICIAL", "companionRef":"cat_001", "displayName":"白羽澪", "isCurrent":true},
            {"identityKey":"ASSET:private", "companionMode":"ASSET", "companionRef":"private", "displayName":"自建", "modelResourceId":"user_model:asset", "modelUrl":"https://store.example/file.zip?signature=private"},
            {"identityKey":"ASSET:invalid", "companionMode":"ASSET", "companionRef":"invalid", "displayName":"无模型"}
        ]}));
        assert_eq!(rows.len(), 2);
        assert!(rows[0].choice.current);
        assert!(!serde_json::to_string(&rows[1].choice)
            .unwrap()
            .contains("signature"));
        assert!(download_address("http://store.example/file.zip").is_err());
        assert!(download_address("https://someone@store.example/file.zip").is_err());
    }
}
