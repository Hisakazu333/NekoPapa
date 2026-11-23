//! The local memory service's rules, without processes or I/O: which memory
//! spaces exist (公共记忆 and one per person), the NekoCairn service
//! configuration that binds each space to its own token, which operations
//! the window may ask for, and how a service reply becomes a result.
//!
//! NekoCairn binds a memory space (`Scope`) to the bearer token, never to the
//! request body, so the host gives every space its own random token and keeps
//! the tokens on this side: the window names a space, the host picks the token.

use serde_json::{json, Value};

/// The user every space on this device belongs to.
pub const LOCAL_USER: &str = "local";
/// 公共记忆: what every chat may use.
pub const SHARED: &str = "shared";
const CONTACT: &str = "contact:";
const MAX_SCOPES: usize = 64;

/// Operations the memory page uses: reading, the user's own corrections and
/// pins, dismissing a pending proposal, and forgetting (planned, then applied).
const OPERATIONS: [&str; 9] = [
    "consent.state",
    "consent",
    "entries.list",
    "entries.get",
    "entries.write",
    "writes.pending",
    "writes.cancel",
    "forget.plan",
    "forget.apply",
];

/// A space id from the window: `shared`, or `contact:<id>` for one person.
pub fn check_scope(scope: &str) -> Result<(), String> {
    if scope == SHARED {
        return Ok(());
    }
    let id = scope.strip_prefix(CONTACT).ok_or("未知的记忆空间。")?;
    let valid = !id.is_empty()
        && id.len() <= 120
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'));
    if valid {
        Ok(())
    } else {
        Err("记忆空间的名称无效。".into())
    }
}

pub fn check_operation(operation: &str) -> Result<(), String> {
    if OPERATIONS.contains(&operation) {
        Ok(())
    } else {
        Err(format!("记忆页不支持 {operation}。"))
    }
}

/// NekoCairn's companion reference for a space.
pub fn companion_ref(scope: &str) -> String {
    match scope.strip_prefix(CONTACT) {
        Some(id) => format!("nekopapa.contact.{id}"),
        None => "nekopapa.shared".into(),
    }
}

/// The environment variable that carries a space's token to the service.
pub fn token_env(index: usize) -> String {
    format!("NEKOPAPA_MEMORY_TOKEN_{index}")
}

/// The service configuration: one SQLite profile (raw text kept, no model),
/// and one auth entry per space, in the given order (tokens come from the
/// environment, never written to disk).
pub fn service_config(database: &str, scopes: &[String]) -> Result<Value, String> {
    if scopes.is_empty() || scopes.len() > MAX_SCOPES {
        return Err("记忆空间数量超出范围。".into());
    }
    let auth: Vec<Value> = scopes
        .iter()
        .enumerate()
        .map(|(index, scope)| {
            json!({
                "token_env": token_env(index),
                "principal_id": format!("nekopapa-{index}"),
                "scope": { "user_id": LOCAL_USER, "companion_ref": companion_ref(scope) },
                "profiles": ["main"],
            })
        })
        .collect();
    Ok(json!({
        "profiles": { "main": {
            "storage": { "kind": "sqlite", "path": database, "sqlite_options": { "journal_mode": "wal" } },
            "extractor": "verbatim",
        } },
        "auth": auth,
        "worker_concurrency": 1,
        "job_timeout_seconds": 120,
    }))
}

/// The `result` of a service reply, or its error as a sentence the page can show.
pub fn read_reply(status: u16, body: &str) -> Result<Value, String> {
    let parsed: Value = serde_json::from_str(body)
        .map_err(|_| format!("记忆服务返回了无法读取的内容（HTTP {status}）。"))?;
    if parsed.get("ok") == Some(&Value::Bool(true)) {
        return Ok(parsed.get("result").cloned().unwrap_or(Value::Null));
    }
    let error = parsed.get("error");
    let code = error
        .and_then(|e| e.get("code"))
        .and_then(Value::as_str)
        .unwrap_or("error");
    let message = error
        .and_then(|e| e.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("未知错误");
    Err(format!("记忆服务：{message}（{code}）"))
}
