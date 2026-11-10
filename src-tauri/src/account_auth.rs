#[path = "account_device.rs"]
pub(crate) mod device;

// Official account login. Bearer tokens stay in the host for this app session.
use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;
use tauri::{Runtime, State, Webview};

const CONFIG: &str = "NEKOPAPA_ACCOUNT_API_URL";
const CANCELED: &str = "登录已取消。";

pub struct AccountAuth {
    state: Mutex<AccountState>,
    connection: Option<(Url, Client)>,
}

impl Default for AccountAuth {
    fn default() -> Self {
        let connection = configured_url().and_then(|url| {
            Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .timeout(Duration::from_secs(12))
                .build()
                .ok()
                .map(|client| (url, client))
        });
        Self {
            state: Mutex::new(AccountState::default()),
            connection,
        }
    }
}

#[derive(Default)]
struct AccountState {
    attempt: Option<String>,
    session: Option<Session>,
    device: Option<device::Challenge>,
}

#[derive(Clone)]
struct Session {
    attempt: String,
    token: String,
    profile: AccountProfile,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountSnapshot {
    configured: bool,
    profile: Option<AccountProfile>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountProfile {
    user_id: u64,
    user_name: Option<String>,
    neko_id: Option<String>,
    cloud_plan_code: Option<String>,
    cloud_point_balance: Option<f64>,
}

#[derive(Deserialize)]
#[serde(tag = "method", rename_all = "snake_case")]
pub enum SignIn {
    Password { mobile: String, password: String },
    Sms { mobile: String, code: String },
}

fn valid_mobile(value: &str) -> bool {
    value.len() == 11 && value.starts_with('1') && value.bytes().all(|digit| digit.is_ascii_digit())
}

fn account_url(value: &str) -> Option<Url> {
    let url = Url::parse(value.trim()).ok()?;
    let loopback = matches!(url.host_str()?, "127.0.0.1" | "[::1]" | "localhost");
    if !matches!(url.scheme(), "https") && !(url.scheme() == "http" && loopback) {
        return None;
    }
    (url.username().is_empty()
        && url.password().is_none()
        && url.query().is_none()
        && url.fragment().is_none())
    .then_some(url)
}

fn configured_url() -> Option<Url> {
    let value = std::env::var(CONFIG)
        .ok()
        .or_else(|| option_env!("NEKOPAPA_ACCOUNT_API_URL").map(str::to_owned))?;
    account_url(&value)
}

fn main_view<R: Runtime>(webview: &Webview<R>) -> Result<(), String> {
    let allowed = webview.label() == "main"
        && webview.url().is_ok_and(|url| {
            let origin = url.origin().ascii_serialization();
            (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
                || matches!(
                    origin.as_str(),
                    "http://tauri.localhost" | "https://tauri.localhost"
                )
                || (cfg!(debug_assertions) && origin == "http://127.0.0.1:1420")
        });
    if allowed {
        Ok(())
    } else {
        Err("当前页面不能访问桌面账号。".into())
    }
}

fn lock(auth: &AccountAuth) -> Result<MutexGuard<'_, AccountState>, String> {
    auth.state
        .lock()
        .map_err(|_| "无法读取桌面账号状态。".into())
}

enum RequestFailure {
    Unauthorized,
    Other(String),
}

impl RequestFailure {
    fn message(self) -> String {
        match self {
            Self::Unauthorized => "账号授权已失效，请重新登录。".into(),
            Self::Other(message) => message,
        }
    }
}

async fn request(
    auth: &AccountAuth,
    method: Method,
    path: &str,
    body: Option<Value>,
    token: Option<&str>,
) -> Result<Value, RequestFailure> {
    use RequestFailure::Other;
    let (base, client) = auth
        .connection
        .as_ref()
        .ok_or_else(|| Other("尚未配置官方账号服务地址。".into()))?;
    let mut req = client.request(
        method,
        format!("{}{path}", base.as_str().trim_end_matches('/')),
    );
    if let Some(body) = body {
        req = req.json(&body);
    }
    if let Some(token) = token {
        req = req.bearer_auth(token);
    }
    let response = req
        .send()
        .await
        .map_err(|_| Other("账号服务暂时无法连接，请重试。".into()))?;
    decode_response(response).await
}

async fn decode_response(mut response: reqwest::Response) -> Result<Value, RequestFailure> {
    use RequestFailure::Other;
    let status = response.status();
    if status.as_u16() == 401 {
        return Err(RequestFailure::Unauthorized);
    }
    if !status.is_success() {
        return Err(Other(format!(
            "账号服务请求失败（HTTP {}）。",
            status.as_u16()
        )));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| Other("账号服务响应中断。".into()))?
    {
        if bytes.len() + chunk.len() > 256 * 1024 {
            return Err(Other("账号服务响应过大。".into()));
        }
        bytes.extend_from_slice(&chunk);
    }
    let mut result: Value =
        serde_json::from_slice(&bytes).map_err(|_| Other("无法读取账号服务响应。".into()))?;
    match result["code"].as_i64() {
        Some(200) => Ok(result["data"].take()),
        Some(401) => Err(RequestFailure::Unauthorized),
        Some(429) => Err(Other("操作过于频繁，请稍后再试。".into())),
        Some(503) => Err(Other("当前登录或短信服务不可用，请稍后重试。".into())),
        Some(code) => Err(Other(format!(
            "账号服务未完成操作（代码 {code}），请重试。"
        ))),
        None => Err(Other("账号服务响应缺少状态。".into())),
    }
}

#[tauri::command]
pub async fn account_snapshot<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
) -> Result<AccountSnapshot, String> {
    main_view(&webview)?;
    let profile = lock(&auth)?
        .session
        .as_ref()
        .map(|session| session.profile.clone());
    Ok(AccountSnapshot {
        configured: auth.connection.is_some(),
        profile,
    })
}

#[tauri::command]
pub async fn account_send_code<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
    mobile: String,
) -> Result<(), String> {
    main_view(&webview)?;
    if !valid_mobile(&mobile) {
        return Err("请填写有效的 11 位手机号。".into());
    }
    request(
        &auth,
        Method::POST,
        "/api/app/auth/mobile/code",
        Some(json!({ "mobile": mobile })),
        None,
    )
    .await
    .map_err(RequestFailure::message)?;
    Ok(())
}

#[tauri::command]
pub async fn account_sign_in<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
    attempt: String,
    credentials: SignIn,
) -> Result<AccountProfile, String> {
    main_view(&webview)?;
    sign_in(&auth, attempt, credentials).await
}

async fn sign_in(
    auth: &AccountAuth,
    attempt: String,
    credentials: SignIn,
) -> Result<AccountProfile, String> {
    let (path, body) = match credentials {
        SignIn::Password { mobile, password }
            if valid_mobile(&mobile) && !password.is_empty() && password.len() <= 512 =>
        {
            (
                "/api/app/auth/password/login",
                json!({ "mobile": mobile, "password": password }),
            )
        }
        SignIn::Sms { mobile, code }
            if valid_mobile(&mobile)
                && code.len() == 6
                && code.bytes().all(|digit| digit.is_ascii_digit()) =>
        {
            (
                "/api/app/auth/mobile/login",
                json!({ "mobile": mobile, "code": code }),
            )
        }
        _ => return Err("请检查手机号、密码或验证码。".into()),
    };
    begin_attempt(auth, &attempt)?;
    let data = request(auth, Method::POST, path, Some(body), None)
        .await
        .map_err(|failure| match failure {
            RequestFailure::Unauthorized => "登录验证未通过，请检查手机号和验证信息。".into(),
            other => other.message(),
        })?;
    accept_token(auth, attempt, &data).await
}

fn begin_attempt(auth: &AccountAuth, attempt: &str) -> Result<(), String> {
    if attempt.len() != 36
        || !attempt
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() || byte == b'-')
    {
        return Err("登录请求无效。".into());
    }
    let mut state = lock(auth)?;
    if state.session.is_some() {
        return Err("请先退出当前账号。".into());
    }
    state.attempt = Some(attempt.to_owned());
    state.device = None;
    Ok(())
}

async fn accept_token(
    auth: &AccountAuth,
    attempt: String,
    data: &Value,
) -> Result<AccountProfile, String> {
    if lock(auth)?.attempt.as_deref() != Some(&attempt) {
        return Err(CANCELED.into());
    }
    let token = data["token"]
        .as_str()
        .filter(|token| !token.is_empty() && token.len() <= 8192)
        .ok_or("账号服务未返回有效的登录授权。")?;
    let data = request(
        auth,
        Method::GET,
        "/api/app/user/profile",
        None,
        Some(token),
    )
    .await
    .map_err(RequestFailure::message)?;
    let profile: AccountProfile =
        serde_json::from_value(data).map_err(|_| "账号服务返回的资料无效。")?;
    if profile.user_id == 0
        || profile.user_id > 9_007_199_254_740_991
        || profile
            .cloud_point_balance
            .is_some_and(|balance| balance < 0.0)
    {
        return Err("账号服务返回的资料无效。".into());
    }
    let mut state = lock(auth)?;
    if state.attempt.as_deref() != Some(&attempt) {
        return Err(CANCELED.into());
    }
    state.attempt = None;
    state.device = None;
    state.session = Some(Session {
        attempt,
        token: token.to_owned(),
        profile: profile.clone(),
    });
    Ok(profile)
}

#[tauri::command]
pub async fn account_cancel<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
    attempt: String,
) -> Result<(), String> {
    main_view(&webview)?;
    let mut state = lock(&auth)?;
    if state.attempt.as_deref() == Some(&attempt) {
        state.attempt = None;
        state.device = None;
    }
    if state
        .session
        .as_ref()
        .is_some_and(|session| session.attempt == attempt)
    {
        state.session = None;
    }
    Ok(())
}

#[tauri::command]
pub async fn account_logout<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
) -> Result<(), String> {
    main_view(&webview)?;
    sign_out(&auth).await
}

async fn sign_out(auth: &AccountAuth) -> Result<(), String> {
    let Some(session) = lock(auth)?.session.clone() else {
        return Ok(());
    };
    match request(
        auth,
        Method::POST,
        "/api/app/auth/logout",
        None,
        Some(&session.token),
    )
    .await
    {
        Ok(_) | Err(RequestFailure::Unauthorized) => (),
        Err(error) => return Err(error.message()),
    }
    let mut state = lock(auth)?;
    if state
        .session
        .as_ref()
        .is_some_and(|active| active.attempt == session.attempt)
    {
        state.session = None;
    }
    Ok(())
}

#[cfg(test)]
#[path = "account_auth_tests.rs"]
mod tests;
