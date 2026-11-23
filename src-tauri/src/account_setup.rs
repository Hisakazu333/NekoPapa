//! First-run setup for an account an SMS sign-in just created: choose a
//! nickname and, optionally, a sign-in password. The service's learning
//! onboarding (`/api/app/user/onboarding/complete`) belongs to NekoBuddy and
//! is never completed from the desktop.
use super::{lock, main_view, request, AccountAuth, AccountProfile, RequestFailure, Session};
use reqwest::Method;
use serde::Serialize;
use serde_json::json;
use tauri::{Runtime, State, Webview};

const SIGNED_OUT: &str = "账号已退出或已切换，请重新登录。";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatus {
    pending: bool,
    masked_mobile: Option<String>,
}

/// "13812345678" → "138****5678"; "+447700900123" → "+44******0123".
fn mask(mobile: &str) -> String {
    let chars: Vec<char> = mobile.chars().collect();
    let keep = 3.min(chars.len());
    let tail = chars.len().saturating_sub(4).max(keep);
    let mut masked: String = chars[..keep].iter().collect();
    masked.extend(std::iter::repeat('*').take(tail - keep));
    masked.extend(&chars[tail..]);
    masked
}

fn valid_nickname(value: &str) -> bool {
    (1..=32).contains(&value.chars().count()) && !value.chars().any(char::is_control)
}

fn valid_password(value: &str) -> bool {
    (6..=32).contains(&value.chars().count()) && value.len() <= 72
}

fn current(auth: &AccountAuth) -> Result<Session, String> {
    lock(auth)?.session.clone().ok_or_else(|| SIGNED_OUT.into())
}

fn setup_session(auth: &AccountAuth) -> Result<(Session, String), String> {
    let session = current(auth)?;
    let mobile = session
        .setup_mobile
        .clone()
        .ok_or("当前账号不需要完成设置。")?;
    Ok((session, mobile))
}

/// Applies a change only while the session that requested it is still active.
fn update(
    auth: &AccountAuth,
    attempt: &str,
    apply: impl FnOnce(&mut Session),
) -> Result<(), String> {
    let mut state = lock(auth)?;
    let session = state
        .session
        .as_mut()
        .filter(|session| session.attempt == attempt)
        .ok_or(SIGNED_OUT)?;
    apply(session);
    Ok(())
}

#[tauri::command]
pub async fn account_setup_status<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
) -> Result<SetupStatus, String> {
    main_view(&webview)?;
    status(&auth)
}

fn status(auth: &AccountAuth) -> Result<SetupStatus, String> {
    let mobile = lock(auth)?
        .session
        .as_ref()
        .and_then(|session| session.setup_mobile.clone());
    Ok(SetupStatus {
        pending: mobile.is_some(),
        masked_mobile: mobile.as_deref().map(mask),
    })
}

#[tauri::command]
pub async fn account_setup_dismiss<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
) -> Result<(), String> {
    main_view(&webview)?;
    if let Some(session) = lock(&auth)?.session.as_mut() {
        session.setup_mobile = None;
    }
    Ok(())
}

#[tauri::command]
pub async fn account_update_nickname<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
    nickname: String,
) -> Result<AccountProfile, String> {
    main_view(&webview)?;
    update_nickname(&auth, nickname).await
}

async fn update_nickname(auth: &AccountAuth, nickname: String) -> Result<AccountProfile, String> {
    let nickname = nickname.trim().to_owned();
    if !valid_nickname(&nickname) {
        return Err("昵称需为 1–32 个字符，且不能包含控制字符。".into());
    }
    let session = current(auth)?;
    let data = request(
        auth,
        Method::POST,
        "/api/app/user/nickname",
        Some(json!({ "nickname": nickname })),
        Some(&session.token),
    )
    .await
    .map_err(RequestFailure::login_message)?;
    let saved = data["userName"]
        .as_str()
        .filter(|name| valid_nickname(name))
        .unwrap_or(&nickname);
    let mut profile = session.profile;
    profile.user_name = Some(saved.to_owned());
    update(auth, &session.attempt, |active| {
        active.profile = profile.clone()
    })?;
    Ok(profile)
}

#[tauri::command]
pub async fn account_send_password_code<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
) -> Result<(), String> {
    main_view(&webview)?;
    send_password_code(&auth).await
}

async fn send_password_code(auth: &AccountAuth) -> Result<(), String> {
    let (session, mobile) = setup_session(auth)?;
    request(
        auth,
        Method::POST,
        "/api/app/user/send-code",
        Some(json!({ "type": "phone", "account": mobile })),
        Some(&session.token),
    )
    .await
    .map_err(RequestFailure::login_message)?;
    Ok(())
}

#[tauri::command]
pub async fn account_set_password<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
    code: String,
    password: String,
) -> Result<(), String> {
    main_view(&webview)?;
    set_password(&auth, code, password).await
}

/// Binding a password starts a new service session, so the returned token
/// replaces the one this sign-in held.
async fn set_password(auth: &AccountAuth, code: String, password: String) -> Result<(), String> {
    if code.len() != 6 || !code.bytes().all(|digit| digit.is_ascii_digit()) {
        return Err("请输入 6 位短信验证码。".into());
    }
    if !valid_password(&password) {
        return Err("密码需为 6–32 个字符。".into());
    }
    let (session, mobile) = setup_session(auth)?;
    let data = request(
        auth,
        Method::POST,
        "/api/app/auth/password/bind",
        Some(json!({ "mobile": mobile, "password": password, "code": code })),
        Some(&session.token),
    )
    .await
    .map_err(RequestFailure::login_message)?;
    let token = data["token"]
        .as_str()
        .filter(|token| !token.is_empty() && token.len() <= 8192)
        .ok_or("账号服务未返回有效的登录授权，请重新登录。")?
        .to_owned();
    update(auth, &session.attempt, |active| {
        active.token = token;
        active.setup_mobile = None;
    })
}

#[cfg(test)]
#[path = "account_setup_tests.rs"]
mod tests;
