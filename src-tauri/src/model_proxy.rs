//! The desktop app's chat runtime host. The chat handlers (src/app/api/chat)
//! run in the main window, as they do on the dev server, but their model
//! requests come here: the window cannot call model APIs itself (CORS), and
//! it must never hold an API key.
//!
//! Keys stay on this side. Settings save only the name of an environment
//! variable; a request carries `{{nekopapa-env:NAME}}` where the key goes,
//! and the value is put in just before the request leaves. The window only
//! learns which variables are set and, for the provider's key shape, the
//! first few characters (`sk-ant-`, `gsk_`), never the key.
//!
//! Apps opened from Finder do not inherit the shell's variables, so the
//! login shell's environment is read once (as editors do) and merged over
//! the process environment.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::ipc::Channel;

const MARK_OPEN: &str = "{{nekopapa-env:";
/// A key typed in settings and kept in the keychain (credential_store.rs).
const MARK_SECRET: &str = "{{nekopapa-secret:";
const MARK_CLOSE: &str = "}}";
const PREFIX_CHARS: usize = 8;
const SHELL_TIMEOUT: Duration = Duration::from_secs(4);
const MAX_BODY: usize = 8 * 1024 * 1024;
/// Non-secret variables the environment provider reads; returned in full.
const PLAIN: [&str; 3] = ["AI_PROVIDER", "AI_BASE_URL", "CHAT_MODEL"];

/// A credential variable must look like one (mirrors isCredentialName in
/// src/app/models/chat-model-profile.ts), so a request cannot ask for PATH or HOME.
pub fn is_credential_name(name: &str) -> bool {
    let valid = !name.is_empty()
        && name.len() <= 80
        && name
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
    let upper = name.to_ascii_uppercase();
    valid && (upper.ends_with("KEY") || upper.ends_with("TOKEN") || upper.ends_with("SECRET"))
}

fn login_shell_env() -> HashMap<String, String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    // The marker skips anything the profile prints before env's output.
    let Ok(mut child) = Command::new(shell)
        .args(["-ilc", "printf '\\0NEKOPAPA_ENV\\0'; env -0"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    else {
        return HashMap::new();
    };
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if started.elapsed() < SHELL_TIMEOUT => {
                std::thread::sleep(Duration::from_millis(20))
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return HashMap::new();
            }
        }
    }
    let mut out = Vec::new();
    if child
        .stdout
        .take()
        .map(|mut s| s.read_to_end(&mut out))
        .is_none()
    {
        return HashMap::new();
    }
    parse_env(&out)
}

fn parse_env(out: &[u8]) -> HashMap<String, String> {
    let text = String::from_utf8_lossy(out);
    let Some((_, rest)) = text.split_once("\0NEKOPAPA_ENV\0") else {
        return HashMap::new();
    };
    rest.split('\0')
        .filter_map(|entry| entry.split_once('='))
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
}

fn environment() -> &'static HashMap<String, String> {
    static ENV: OnceLock<HashMap<String, String>> = OnceLock::new();
    ENV.get_or_init(|| {
        let mut env: HashMap<String, String> = std::env::vars().collect();
        env.extend(login_shell_env());
        env
    })
}

fn value(name: &str) -> Option<&'static str> {
    environment()
        .get(name)
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
}

/// Puts each `<prefix>{{nekopapa-env:NAME}}` stand-in's key in place. The
/// prefix is the one `chat_environment` showed the window, so a header
/// built from it ("Bearer sk-ant-a{{…}}") becomes exactly "Bearer <key>".
fn fill_keys(text: &str) -> Result<String, String> {
    fill_keys_with(text, value, |id| crate::credential_store::secret(id))
}

fn fill_keys_with<'a>(
    text: &str,
    lookup: impl Fn(&str) -> Option<&'a str>,
    secret: impl Fn(&str) -> Option<String>,
) -> Result<String, String> {
    let mut out = String::new();
    let mut rest = text;
    loop {
        let env = rest.find(MARK_OPEN);
        let stored = rest.find(MARK_SECRET);
        let (start, mark) = match (env, stored) {
            (Some(a), Some(b)) if b < a => (b, MARK_SECRET),
            (Some(a), _) => (a, MARK_OPEN),
            (None, Some(b)) => (b, MARK_SECRET),
            (None, None) => break,
        };
        let after = &rest[start + mark.len()..];
        let end = after.find(MARK_CLOSE).ok_or("凭据占位符格式无效。")?;
        let name = &after[..end];
        let key = if mark == MARK_SECRET {
            if !crate::credential_store::is_secret_id(name) {
                return Err("密钥编号无效。".into());
            }
            secret(name)
                .ok_or("钥匙串中没有这份配置的 API Key，请在 设置 → 模型与 API 中重新填写。")?
        } else {
            if !is_credential_name(name) {
                return Err(format!("{name} 不是凭据环境变量名。"));
            }
            lookup(name)
                .ok_or(format!("没有找到环境变量 {name}。"))?
                .to_string()
        };
        let prefix: String = key.chars().take(PREFIX_CHARS).collect();
        let before = &rest[..start];
        out.push_str(before.strip_suffix(prefix.as_str()).unwrap_or(before));
        out.push_str(&key);
        rest = &after[end + MARK_CLOSE.len()..];
    }
    out.push_str(rest);
    Ok(out)
}

#[derive(Serialize, Default)]
pub struct ChatEnvironment {
    /// AI_PROVIDER, AI_BASE_URL, CHAT_MODEL when set.
    plain: HashMap<String, String>,
    /// Credential variables that are set, with their first characters only.
    keys: HashMap<String, String>,
    /// `keychain:<id>` references whose key is stored.
    secrets: Vec<String>,
}

/// What the environment provider needs to resolve itself in the window.
#[tauri::command]
pub async fn chat_environment(names: Vec<String>) -> Result<ChatEnvironment, String> {
    let names: Vec<String> = names.into_iter().take(40).collect();
    tauri::async_runtime::spawn_blocking(move || {
        let mut result = ChatEnvironment::default();
        for name in PLAIN {
            if let Some(v) = value(name) {
                result.plain.insert(name.into(), v.into());
            }
        }
        for name in &names {
            if let Some(id) = name.strip_prefix("keychain:") {
                if crate::credential_store::is_secret_id(id)
                    && crate::credential_store::secret(id).is_some()
                {
                    result.secrets.push(id.to_string());
                }
            }
        }
        for name in names.iter().filter(|n| is_credential_name(n)) {
            if let Some(v) = value(name) {
                result
                    .keys
                    .insert(name.clone(), v.chars().take(PREFIX_CHARS).collect());
            }
        }
        result
    })
    .await
    .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct ModelRequest {
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ModelEvent {
    Head {
        status: u16,
        headers: Vec<(String, String)>,
    },
    Chunk {
        data: Vec<u8>,
    },
    End,
    Error {
        message: String,
    },
}

fn requests() -> &'static Mutex<HashMap<u32, tauri::async_runtime::JoinHandle<()>>> {
    static REQUESTS: OnceLock<Mutex<HashMap<u32, tauri::async_runtime::JoinHandle<()>>>> =
        OnceLock::new();
    REQUESTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .build()
            .unwrap_or_default()
    })
}

async fn run(request: ModelRequest, events: &Channel<ModelEvent>) -> Result<(), String> {
    let url = reqwest::Url::parse(&request.url).map_err(|_| "模型服务地址无效。")?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("模型服务只能使用 http 或 https 地址。".into());
    }
    let method = match request.method.to_ascii_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        _ => return Err("不支持的请求方法。".into()),
    };
    if request.body.as_ref().is_some_and(|b| b.len() > MAX_BODY) {
        return Err("请求内容过大。".into());
    }
    let mut builder = client().request(method, url);
    for (name, raw) in &request.headers {
        builder = builder.header(name, fill_keys(raw)?);
    }
    if let Some(body) = request.body {
        builder = builder.body(fill_keys(&body)?);
    }
    let mut response = builder.send().await.map_err(|e| {
        if e.is_connect() {
            "无法连接模型服务。".to_string()
        } else if e.is_timeout() {
            "连接模型服务超时。".to_string()
        } else {
            "模型请求失败。".to_string()
        }
    })?;
    let headers = response
        .headers()
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|v| (k.to_string(), v.to_string())))
        .collect();
    let _ = events.send(ModelEvent::Head {
        status: response.status().as_u16(),
        headers,
    });
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "模型回复中断。".to_string())?
    {
        if events
            .send(ModelEvent::Chunk {
                data: chunk.to_vec(),
            })
            .is_err()
        {
            return Ok(());
        }
    }
    let _ = events.send(ModelEvent::End);
    Ok(())
}

/// One model request for the chat handlers; the reply streams back on `events`.
#[tauri::command]
pub async fn model_fetch(
    id: u32,
    request: ModelRequest,
    events: Channel<ModelEvent>,
) -> Result<(), String> {
    let task = tauri::async_runtime::spawn(async move {
        if let Err(message) = run(request, &events).await {
            let _ = events.send(ModelEvent::Error { message });
        }
        requests().lock().map(|mut all| all.remove(&id)).ok();
    });
    requests()
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id, task);
    Ok(())
}

/// Stop pressed, or the chat went away: drops the request, which closes the connection.
#[tauri::command]
pub async fn model_fetch_cancel(id: u32) -> Result<(), String> {
    if let Some(task) = requests().lock().map_err(|e| e.to_string())?.remove(&id) {
        task.abort();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{fill_keys_with, is_credential_name, parse_env};

    #[test]
    fn fills_keys_where_the_stand_ins_were() {
        let lookup = |name: &str| (name == "AI_API_KEY").then_some("sk-ant-secret-value");
        let secret = |id: &str| (id == "r1").then(|| "sk-typed-in-settings".to_string());
        assert_eq!(
            fill_keys_with("Bearer sk-ant-s{{nekopapa-env:AI_API_KEY}}", lookup, secret).unwrap(),
            "Bearer sk-ant-secret-value"
        );
        assert_eq!(
            fill_keys_with("{{nekopapa-env:AI_API_KEY}}", lookup, secret).unwrap(),
            "sk-ant-secret-value"
        );
        assert_eq!(
            fill_keys_with("no stand-in", lookup, secret).unwrap(),
            "no stand-in"
        );
        assert!(fill_keys_with("{{nekopapa-env:PATH}}", lookup, secret).is_err());
        assert!(fill_keys_with("{{nekopapa-env:OTHER_KEY}}", lookup, secret).is_err());
        assert!(fill_keys_with("{{nekopapa-env:AI_API_KEY", lookup, secret).is_err());
        assert_eq!(
            fill_keys_with("Bearer {{nekopapa-secret:r1}}", lookup, secret).unwrap(),
            "Bearer sk-typed-in-settings"
        );
        assert!(fill_keys_with("{{nekopapa-secret:r2}}", lookup, secret).is_err());
        assert!(fill_keys_with("{{nekopapa-secret:../x}}", lookup, secret).is_err());
    }

    #[test]
    fn only_credential_looking_names_are_filled() {
        for name in ["OPENAI_API_KEY", "MODEL_TOKEN", "my_secret", "AI_API_KEY"] {
            assert!(is_credential_name(name), "{name}");
        }
        for name in ["PATH", "HOME", "", "1_KEY", "A-B_KEY", "KEY NAME"] {
            assert!(!is_credential_name(name), "{name}");
        }
    }

    #[test]
    fn reads_the_environment_after_the_marker() {
        let out = b"welcome banner\n\0NEKOPAPA_ENV\0A=1\0B_KEY=x=y\0";
        let env = parse_env(out);
        assert_eq!(env.get("A").map(String::as_str), Some("1"));
        assert_eq!(env.get("B_KEY").map(String::as_str), Some("x=y"));
        assert!(parse_env(b"no marker").is_empty());
    }
}
