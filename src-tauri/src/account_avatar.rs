//! Stores the user's chosen avatar through the authenticated account service.
use super::{
    decode_response, lock, main_view, profile_avatar, AccountAuth, AccountProfile, RequestFailure,
};
use reqwest::multipart::{Form, Part};
use serde::Deserialize;
use tauri::{Runtime, State, Webview};

const LIMIT: usize = 100_000;
const PATH: &str = "/api/app/user/profile/avatar";

fn raster_format(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.len() > LIMIT {
        return None;
    }
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some(("avatar.png", "image/png"))
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        Some(("avatar.jpg", "image/jpeg"))
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        Some(("avatar.webp", "image/webp"))
    } else {
        None
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AvatarReceipt {
    user_id: u64,
    avatar_url: String,
}

#[tauri::command]
pub async fn account_avatar_upload<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
    user_id: u64,
    bytes: Vec<u8>,
) -> Result<AccountProfile, String> {
    main_view(&webview)?;
    upload_avatar(&auth, user_id, bytes).await
}

async fn upload_avatar(
    auth: &AccountAuth,
    user_id: u64,
    bytes: Vec<u8>,
) -> Result<AccountProfile, String> {
    let (filename, mime) = raster_format(&bytes).ok_or("头像图片无效，请重新选择。")?;
    let session = lock(auth)?
        .session
        .as_ref()
        .filter(|session| session.profile.user_id == user_id)
        .cloned()
        .ok_or("账号已切换，请重新打开个人资料。")?;
    let _upload = auth.avatar_uploading.lock().await;
    if !lock(auth)?
        .session
        .as_ref()
        .is_some_and(|active| active.attempt == session.attempt)
    {
        return Err("账号已切换，请重新打开个人资料。".into());
    }
    let (base, client) = auth
        .connection
        .as_ref()
        .ok_or("尚未配置官方账号服务地址。")?;
    let file = Part::bytes(bytes)
        .file_name(filename)
        .mime_str(mime)
        .map_err(|_| "头像图片格式无效。")?;
    let response = client
        .post(format!("{}{PATH}", base.as_str().trim_end_matches('/')))
        .bearer_auth(&session.token)
        .multipart(Form::new().part("file", file))
        .send()
        .await
        .map_err(|_| "头像上传未完成，请重试。")?;
    let receipt = decode_response(response).await;
    let mut state = lock(auth)?;
    let active = state
        .session
        .as_mut()
        .filter(|active| active.attempt == session.attempt)
        .ok_or("账号已切换，请重新打开个人资料。")?;
    if matches!(receipt, Err(RequestFailure::Unauthorized)) {
        state.session = None;
        return Err("账号授权已失效，请重新登录。".into());
    }
    let receipt: AvatarReceipt = serde_json::from_value(receipt.map_err(RequestFailure::message)?)
        .map_err(|_| "账号服务返回的头像信息无效。")?;
    if receipt.user_id != user_id {
        return Err("头像回执与当前账号不匹配。".into());
    }
    let avatar = profile_avatar(base, &receipt.avatar_url).ok_or("账号服务返回的头像地址无效。")?;
    active.profile.avatar_url = Some(avatar);
    Ok(active.profile.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::account_auth::Session;
    use std::io::{BufRead, BufReader, Read, Write};
    use std::net::TcpListener;
    use std::time::Duration;

    #[test]
    fn avatar_upload_admits_only_bounded_raster_formats() {
        assert_eq!(
            raster_format(b"\x89PNG\r\n\x1a\nfixture"),
            Some(("avatar.png", "image/png"))
        );
        assert_eq!(
            raster_format(b"\xff\xd8\xfffixture"),
            Some(("avatar.jpg", "image/jpeg"))
        );
        assert_eq!(
            raster_format(b"RIFF\0\0\0\0WEBP"),
            Some(("avatar.webp", "image/webp"))
        );
        assert!(raster_format(b"<svg>").is_none());
        let mut large = b"\x89PNG\r\n\x1a\n".to_vec();
        large.resize(LIMIT + 1, 0);
        assert!(raster_format(&large).is_none());
    }

    #[test]
    fn avatar_upload_uses_the_session_and_merges_the_authoritative_profile() {
        let server = TcpListener::bind("127.0.0.1:0").unwrap();
        let origin = format!("http://{}", server.local_addr().unwrap());
        let fixture = std::thread::spawn(move || {
            let (stream, _) = server.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            let mut reader = BufReader::new(stream);
            let mut headers = String::new();
            loop {
                let mut line = String::new();
                assert!(reader.read_line(&mut line).unwrap() > 0);
                if line == "\r\n" {
                    break;
                }
                headers.push_str(&line);
            }
            assert!(headers.starts_with("POST /api/app/user/profile/avatar HTTP/1.1"));
            let headers = headers.to_ascii_lowercase();
            assert!(headers.contains("authorization: bearer fixture-token"));
            let length: usize = headers
                .lines()
                .find_map(|line| line.strip_prefix("content-length: "))
                .unwrap()
                .parse()
                .unwrap();
            let mut body = vec![0; length];
            reader.read_exact(&mut body).unwrap();
            let body = String::from_utf8_lossy(&body);
            assert!(body.contains(r#"name="file"; filename="avatar.png""#));
            assert!(body
                .to_ascii_lowercase()
                .contains("content-type: image/png"));
            let json = r#"{"code":200,"data":{"userId":7,"avatarUrl":"/profile/avatar/new.png"}}"#;
            write!(
                reader.get_mut(),
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{json}",
                json.len()
            )
            .unwrap();
        });
        let mut auth = AccountAuth::new("0.1.0".into());
        auth.connection = Some((origin.parse().unwrap(), reqwest::Client::new()));
        lock(&auth).unwrap().session = Some(Session {
            attempt: "fixture".into(),
            token: "fixture-token".into(),
            cabin: None,
            previous_cabin: None,
            setup_mobile: None,
            profile: serde_json::from_value(serde_json::json!({"userId":7,"cloudPointBalance":42}))
                .unwrap(),
        });
        let png = b"\x89PNG\r\n\x1a\nfixture".to_vec();
        let profile = tauri::async_runtime::block_on(async {
            assert!(upload_avatar(&auth, 8, png.clone()).await.is_err());
            upload_avatar(&auth, 7, png).await.unwrap()
        });
        assert_eq!(
            profile.avatar_url,
            Some(format!("{origin}/profile/avatar/new.png"))
        );
        assert_eq!(profile.cloud_point_balance, Some(42.0));
        fixture.join().unwrap();
    }
}
