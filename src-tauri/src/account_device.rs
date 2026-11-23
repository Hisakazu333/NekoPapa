// NekoBuddy phone approval is an alternative to direct sign-in.
use super::{
    accept_token, begin_attempt, lock, main_view, request, AccountAuth, AccountProfile,
    RequestFailure, CANCELED,
};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::{Duration, Instant};
use tauri::{Runtime, State, Webview};

#[derive(Clone)]
pub(super) struct Challenge {
    session_id: String,
    device_code: String,
    deadline: Instant,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeviceStart {
    session_id: String,
    device_code: String,
    qr_text: String,
    expire_seconds: u64,
    poll_interval_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCode {
    qr_text: String,
    expire_seconds: u64,
    poll_interval_ms: u64,
}

#[derive(Serialize)]
pub struct DeviceStatus {
    status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    profile: Option<AccountProfile>,
}

impl DeviceStatus {
    fn pending(status: &'static str) -> Self {
        Self {
            status,
            profile: None,
        }
    }
}

fn valid_code(code: &DeviceStart) -> bool {
    let id = |value: &str| {
        !value.is_empty()
            && value.len() <= 128
            && value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    };
    id(&code.session_id)
        && id(&code.device_code)
        && (1..=3600).contains(&code.expire_seconds)
        && code.poll_interval_ms > 0
        && code.qr_text
            == format!(
                "nekobuddy://login/confirm?sessionId={}&deviceCode={}",
                code.session_id, code.device_code
            )
}

#[tauri::command]
pub async fn account_device_start<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
    attempt: String,
) -> Result<DeviceCode, String> {
    main_view(&webview)?;
    begin_attempt(&auth, &attempt)?;
    let data = request(
        &auth,
        Method::POST,
        "/api/app/auth/device/start",
        Some(json!({ "deviceName": "NekoPapa", "clientVersion": &auth.version })),
        None,
    )
    .await
    .map_err(RequestFailure::login_message)?;
    let code: DeviceStart =
        serde_json::from_value(data).map_err(|_| "账号服务返回的二维码信息无效。")?;
    if !valid_code(&code) {
        return Err("账号服务返回的二维码信息无效。".into());
    }
    let mut state = lock(&auth)?;
    if state.attempt.as_deref() != Some(&attempt) {
        return Err(CANCELED.into());
    }
    state.device = Some(Challenge {
        session_id: code.session_id,
        device_code: code.device_code,
        deadline: Instant::now() + Duration::from_secs(code.expire_seconds),
    });
    Ok(DeviceCode {
        qr_text: code.qr_text,
        expire_seconds: code.expire_seconds,
        poll_interval_ms: code.poll_interval_ms.clamp(1000, 30_000),
    })
}

#[tauri::command]
pub async fn account_device_poll<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
    attempt: String,
) -> Result<DeviceStatus, String> {
    main_view(&webview)?;
    let challenge = {
        let state = lock(&auth)?;
        if state.attempt.as_deref() != Some(&attempt) {
            return Err(CANCELED.into());
        }
        state.device.clone().ok_or(CANCELED)?
    };
    if Instant::now() >= challenge.deadline {
        return Ok(DeviceStatus::pending("EXPIRED"));
    }
    let data = request(
        &auth,
        Method::POST,
        "/api/app/auth/device/poll",
        Some(json!({ "sessionId": challenge.session_id, "deviceCode": challenge.device_code })),
        None,
    )
    .await
    .map_err(RequestFailure::message)?;
    match data["status"].as_str() {
        Some("WAITING") => Ok(DeviceStatus::pending("WAITING")),
        Some("SCANNED") => Ok(DeviceStatus::pending("SCANNED")),
        Some("EXPIRED") => Ok(DeviceStatus::pending("EXPIRED")),
        Some("CANCELED") => Ok(DeviceStatus::pending("CANCELED")),
        Some("CONSUMED") => Ok(DeviceStatus::pending("CONSUMED")),
        Some("CONFIRMED") => {
            let profile = accept_token(&auth, attempt, &data["login"], None).await?;
            Ok(DeviceStatus {
                status: "CONFIRMED",
                profile: Some(profile),
            })
        }
        _ => Err("账号服务返回了未知扫码状态。".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_matching_device_qr() {
        let mut code = DeviceStart {
            session_id: "dl_session".into(),
            device_code: "code-1".into(),
            qr_text: "nekobuddy://login/confirm?sessionId=dl_session&deviceCode=code-1".into(),
            expire_seconds: 60,
            poll_interval_ms: 1500,
        };
        assert!(valid_code(&code));
        code.qr_text = "https://example.test".into();
        assert!(!valid_code(&code));
    }
}
