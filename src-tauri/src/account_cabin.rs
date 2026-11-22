//! Resolve the signed-in user's current companion before asking for a signed model package.
#[path = "account_cabin_roster.rs"]
pub(crate) mod roster;

use super::{lock, main_view, request, AccountAuth, RequestFailure, Session};
use crate::{cabin_archive::MAX_DOWNLOAD, cabin_files::CabinFiles};
use reqwest::{Method, Url};
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{sync::Arc, time::Duration};
use tauri::{
    http::{Request, Response},
    Manager, Runtime, State, UriSchemeContext, UriSchemeResponder, Webview,
};

const CURRENT: &str = "/api/app/companion/current";

fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str, String> {
    v[key]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("同伴资源缺少 {key}。"))
}

fn number(v: &Value, key: &str) -> Result<u64, String> {
    v[key]
        .as_u64()
        .or_else(|| v[key].as_str()?.parse().ok())
        .filter(|n| *n > 0)
        .ok_or_else(|| format!("同伴资源的 {key} 无效。"))
}

fn identity(v: &Value) -> Result<&str, String> {
    if v["isCurrent"] != true {
        return Err("账号没有有效的当前同伴。".into());
    }
    companion_identity(v)
}

fn companion_identity(v: &Value) -> Result<&str, String> {
    let id = text(v, "identityKey")?;
    let mode = text(v, "companionMode")?;
    if !matches!(mode, "OFFICIAL" | "ASSET") || id != format!("{mode}:{}", text(v, "companionRef")?)
    {
        return Err("同伴身份无效。".into());
    }
    Ok(id)
}

async fn authorized(
    auth: &AccountAuth,
    s: &Session,
    method: Method,
    path: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    if lock(auth)?.session.as_ref().map(|active| &active.attempt) != Some(&s.attempt) {
        return Err("账号已切换，请重新打开小屋。".into());
    }
    let result = request(auth, method, path, body, Some(&s.token)).await;
    let mut state = lock(auth)?;
    if !state
        .session
        .as_ref()
        .is_some_and(|active| active.attempt == s.attempt)
    {
        return Err("账号已切换，请重新打开小屋。".into());
    }
    if matches!(result, Err(RequestFailure::Unauthorized)) {
        state.session = None;
    }
    result.map_err(|error| cabin_request_failure(path, error))
}

fn cabin_request_failure(path: &str, error: RequestFailure) -> String {
    let step = match path {
        CURRENT => "读取当前同伴失败",
        roster::ROSTER => "读取同伴名册失败",
        _ => "获取模型下载地址失败",
    };
    match error {
        RequestFailure::Unauthorized => RequestFailure::Unauthorized.message(),
        RequestFailure::Business { message, .. }
            if message == "这位官方同伴的 Live2D 模型尚未开放" =>
        {
            "当前同伴的 Live2D 模型暂未对本版本开放。".into()
        }
        error => format!("{step}。{}", error.message()),
    }
}

struct Package {
    url: Url,
    size: u64,
    digest: String,
    entries: Vec<String>,
}

fn official_archive_entries(root: &str, path: &str) -> Vec<String> {
    let prefix = format!("{}/", root.trim_end_matches('/'));
    let published = if path.starts_with(&prefix) {
        path.to_owned()
    } else {
        format!("{prefix}{path}")
    };
    // The catalog publishes an installation path, while the ZIP omits the
    // "live2d/" namespace. Legacy archives can contain the full path.
    let mut entries = Vec::new();
    if let Some(entry) = published.strip_prefix("live2d/") {
        entries.push(entry.to_owned());
    }
    entries.push(published);
    entries
}

fn package(url: &str, size: u64, digest: &str, entries: Vec<String>) -> Result<Package, String> {
    let url = Url::parse(url).map_err(|_| "模型下载地址无效。")?;
    let digest = digest.strip_prefix("sha256:").unwrap_or(digest);
    if url.scheme() != "https"
        || url.domain().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || size == 0
        || size > MAX_DOWNLOAD
        || digest.len() != 64
        || !digest.bytes().all(|b| b.is_ascii_hexdigit())
        || entries.is_empty()
        || !entries.iter().all(|entry| entry.ends_with(".model3.json"))
    {
        return Err("模型签名下载清单无效。".into());
    }
    Ok(Package {
        url,
        size,
        digest: digest.to_ascii_lowercase(),
        entries,
    })
}

async fn descriptor(
    auth: &AccountAuth,
    session: &Session,
    current: &Value,
) -> Result<Package, String> {
    let reference = text(current, "companionRef")?;
    match text(current, "companionMode")? {
        "OFFICIAL" => {
            let mut path = format!(
                "/api/app/companion/live2d/download-url?companionRef={}",
                percent_encoding::utf8_percent_encode(
                    reference,
                    percent_encoding::NON_ALPHANUMERIC
                )
            );
            if let Ok(model) = text(current, "modelResourceId") {
                path.push_str(&format!(
                    "&modelId={}",
                    percent_encoding::utf8_percent_encode(
                        model,
                        percent_encoding::NON_ALPHANUMERIC
                    )
                ));
            }
            let d = authorized(auth, session, Method::GET, &path, None).await?;
            if text(&d, "companionRef")? != reference {
                return Err("发布包与当前同伴不匹配。".into());
            }
            package(
                text(&d, "downloadUrl")?,
                number(&d, "archiveSizeBytes")?,
                text(&d, "archiveSha256")?,
                official_archive_entries(text(&d, "rootDir")?, text(&d, "model3Path")?),
            )
        }
        "ASSET" => {
            let live = &current["resources"]["live2d"];
            let a = &live["archive"];
            if text(a, "companionRef")? != reference || text(a, "companionMode")? != "ASSET" {
                return Err("当前同伴没有可下载的模型包。".into());
            }
            let size = number(a, "fileSize")?;
            let resource = number(a, "resourceId")?;
            let hash = text(a, "contentHash")?;
            let key = text(a, "objectKey")?;
            let body = json!({"items":[{"resourceId":resource,"companionMode":"ASSET","companionRef":reference,"objectKey":key,"contentHash":hash,"fileSize":size}]});
            let d = authorized(
                auth,
                session,
                Method::POST,
                "/api/app/companion/resources/download-urls",
                Some(body),
            )
            .await?;
            let items = d["items"]
                .as_array()
                .filter(|i| i.len() == 1)
                .ok_or("模型下载未获授权。")?;
            let signed = &items[0];
            if text(signed, "companionRef")? != reference
                || text(signed, "companionMode")? != "ASSET"
                || number(signed, "resourceId")? != resource
                || text(signed, "objectKey")? != key
                || text(signed, "contentHash")? != hash
                || number(signed, "fileSize")? != size
            {
                return Err("模型签名回执与账号资源不匹配。".into());
            }
            package(
                text(signed, "downloadUrl")?,
                size,
                hash,
                vec![text(live, "model3Path")
                    .or_else(|_| text(&a["payload"], "model3Path"))?
                    .to_owned()],
            )
        }
        _ => Err("账号当前同伴的模型类型尚不支持。".into()),
    }
}

async fn download(p: &Package) -> Result<Vec<u8>, String> {
    // The signed object URL receives no account credentials or app API headers.
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|_| "无法准备 OSS 下载。")?;
    let mut response = client
        .get(p.url.clone())
        .send()
        .await
        .map_err(|_| "未能连接 OSS，请重试。")?;
    if !response.status().is_success() || response.content_length().is_some_and(|n| n != p.size) {
        return Err("OSS 下载地址已失效或包体大小不符。".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "模型下载中断。")? {
        if (bytes.len() + chunk.len()) as u64 > p.size {
            return Err("模型超过清单大小。".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    if bytes.len() as u64 != p.size || format!("{:x}", Sha256::digest(&bytes)) != p.digest {
        return Err("模型包未通过大小或 SHA-256 校验。".into());
    }
    Ok(bytes)
}

#[derive(Serialize)]
pub struct Prepared {
    name: String,
    level: Option<u64>,
    affinity: Option<u64>,
    mount: String,
    entry: String,
}

#[tauri::command]
pub async fn account_cabin_prepare<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
    companion_key: Option<String>,
) -> Result<Prepared, String> {
    main_view(&webview)?;
    let session = lock(&auth)?.session.clone().ok_or("请先登录 NekoPapa。")?;
    let _guard = auth.cabin_loading.lock().await;
    let current = active_profile(&auth, &session, companion_key.as_deref()).await?;
    let id = companion_identity(&current)?.to_owned();
    let spec = descriptor(&auth, &session, &current).await?;
    let cached = {
        let state = lock(&auth)?;
        state
            .session
            .as_ref()
            .filter(|s| s.attempt == session.attempt)
            .and_then(|s| {
                [s.cabin.as_ref(), s.previous_cabin.as_ref()]
                    .into_iter()
                    .flatten()
                    .find(|file| file.identity == id && file.digest == spec.digest)
                    .cloned()
            })
    };
    let files = if let Some(files) = cached {
        files
    } else {
        let bytes = download(&spec).await?;
        let id = id.clone();
        Arc::new(
            tauri::async_runtime::spawn_blocking(move || {
                CabinFiles::install(&bytes, id, spec.digest, &spec.entries)
            })
            .await
            .map_err(|_| "模型解包中断。")??,
        )
    };
    let confirmed = active_profile(&auth, &session, companion_key.as_deref()).await?;
    if companion_identity(&confirmed)? != id
        || (current["companionMode"] == "ASSET"
            && current["resources"]["live2d"]["archive"]["contentHash"]
                != confirmed["resources"]["live2d"]["archive"]["contentHash"])
    {
        return Err("同伴资料已更新，请重新载入。".into());
    }
    let name = text(&confirmed, "displayName")?.to_owned();
    let mut state = lock(&auth)?;
    let active = state
        .session
        .as_mut()
        .filter(|s| s.attempt == session.attempt)
        .ok_or("登录已失效。")?;
    let prepared = Prepared {
        name,
        level: roster::level(&confirmed),
        affinity: roster::affinity(&confirmed),
        mount: files.mount.clone(),
        entry: files.entry.clone(),
    };
    if !active
        .cabin
        .as_ref()
        .is_some_and(|file| Arc::ptr_eq(file, &files))
    {
        active.previous_cabin = active.cabin.replace(files);
    }
    Ok(prepared)
}

async fn active_profile(
    auth: &AccountAuth,
    session: &Session,
    preview: Option<&str>,
) -> Result<Value, String> {
    if let Some(key) = preview {
        return roster::preview_profile(auth, session, key).await;
    }
    let current = authorized(auth, session, Method::GET, CURRENT, None).await?;
    identity(&current)?;
    Ok(current)
}

pub fn serve<R: Runtime>(
    context: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let app = context.app_handle().clone();
    let main = context.webview_label() == "main" && request.method() == tauri::http::Method::GET;
    tauri::async_runtime::spawn_blocking(move || {
        let auth = app.state::<AccountAuth>();
        let files = if main {
            lock(&auth)
                .ok()
                .and_then(|s| s.session.as_ref()?.cabin.clone())
        } else {
            None
        };
        let response = files
            .and_then(|f| f.response(request.uri().path(), &request))
            .unwrap_or_else(|| Response::builder().status(404).body(vec![]).unwrap());
        responder.respond(response)
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn current_identity_and_signed_descriptors_must_match_the_contract() {
        assert!(identity(&json!({"identityKey":"OFFICIAL:a","companionRef":"b","companionMode":"OFFICIAL","isCurrent":true})).is_err());
        let digest = "a".repeat(64);
        assert!(package(
            "https://objects.example/model",
            22,
            &digest,
            vec!["package/scene.model3.json".into()]
        )
        .is_ok());
        assert!(package(
            "http://objects.example/model",
            22,
            &digest,
            vec!["model.model3.json".into()]
        )
        .is_err());
        assert!(package(
            "https://objects.example/model",
            22,
            "invalid",
            vec!["model.model3.json".into()]
        )
        .is_err());
    }

    #[test]
    fn official_zip_entry_omits_the_catalog_namespace_and_accepts_legacy_paths() {
        let entries =
            official_archive_entries("live2d/mio/v1", "live2d/mio/v1/runtime/mio.model3.json");
        assert_eq!(
            entries,
            [
                "mio/v1/runtime/mio.model3.json",
                "live2d/mio/v1/runtime/mio.model3.json"
            ]
        );
        assert_eq!(
            entries,
            official_archive_entries("live2d/mio/v1/", "runtime/mio.model3.json")
        );
        assert_eq!(
            official_archive_entries("sample", "model.model3.json"),
            ["sample/model.model3.json"]
        );
    }

    #[test]
    fn cabin_errors_identify_the_step_without_displaying_server_details() {
        let business = |message: &str| RequestFailure::Business {
            code: 500,
            message: message.into(),
        };
        let failure = cabin_request_failure(CURRENT, business("internal server detail"));
        assert!(
            failure.contains("读取当前同伴失败") && !failure.contains("internal server detail")
        );
        let signer = "/api/app/companion/live2d/download-url?companionRef=cat_001";
        assert!(
            cabin_request_failure(signer, business("internal server detail"))
                .contains("获取模型下载地址失败")
        );
        assert_eq!(
            cabin_request_failure(signer, business("这位官方同伴的 Live2D 模型尚未开放")),
            "当前同伴的 Live2D 模型暂未对本版本开放。"
        );
    }
}
