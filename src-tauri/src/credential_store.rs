//! API keys typed in 设置 → 模型与 API, kept in the system keychain (macOS
//! Keychain, Windows Credential Manager, the Secret Service on Linux) — never
//! in the window's storage, settings backups or request bodies.
//!
//! The window stores a key once (`credential_set`) and from then on only
//! refers to it as `keychain:<id>`; a model request carries the stand-in
//! `{{nekopapa-secret:<id>}}` and model_proxy.rs puts the key in just before
//! the request leaves. Keys are read once per run and kept in memory, so the
//! keychain is not asked on every request.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

const SERVICE: &str = "NekoPapa 模型 API Key";
const MAX_SECRET: usize = 4096;

/// Ids are record ids: letters, digits, `-` and `_`.
pub fn is_secret_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn cache() -> &'static Mutex<HashMap<String, Option<String>>> {
    static CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn entry(id: &str) -> Result<keyring::Entry, String> {
    if !is_secret_id(id) {
        return Err("密钥编号无效。".into());
    }
    keyring::Entry::new(SERVICE, id).map_err(|e| format!("无法访问钥匙串：{e}"))
}

/// The key stored under `id`, if any.
pub fn secret(id: &str) -> Option<String> {
    if let Some(known) = cache().lock().ok().and_then(|all| all.get(id).cloned()) {
        return known;
    }
    let value = entry(id).ok().and_then(|e| e.get_password().ok()).filter(|v| !v.is_empty());
    if let Ok(mut all) = cache().lock() {
        all.insert(id.to_string(), value.clone());
    }
    value
}

/// Saves (or replaces) the key for one model configuration.
#[tauri::command]
pub async fn credential_set(id: String, secret: String) -> Result<(), String> {
    let secret = secret.trim().to_string();
    if secret.is_empty() || secret.len() > MAX_SECRET || secret.chars().any(char::is_control) {
        return Err("API Key 为空或包含无效字符。".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        entry(&id)?.set_password(&secret).map_err(|e| format!("无法写入钥匙串：{e}"))?;
        if let Ok(mut all) = cache().lock() {
            all.insert(id, Some(secret));
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Removes a stored key; removing one that is not there is not an error.
#[tauri::command]
pub async fn credential_delete(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        match entry(&id)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(e) => return Err(format!("无法从钥匙串删除：{e}")),
        }
        if let Ok(mut all) = cache().lock() {
            all.insert(id, None);
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Which of these configurations have a stored key (the keys themselves stay here).
#[tauri::command]
pub async fn credential_has(ids: Vec<String>) -> Result<Vec<String>, String> {
    let ids: Vec<String> = ids.into_iter().filter(|id| is_secret_id(id)).take(100).collect();
    tauri::async_runtime::spawn_blocking(move || ids.into_iter().filter(|id| secret(id).is_some()).collect())
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::is_secret_id;

    #[test]
    fn only_record_ids_name_a_secret() {
        for id in ["r1", "6f1c2e4a-9b7d-4c1e-8f2a-1b2c3d4e5f60", "draft"] {
            assert!(is_secret_id(id), "{id}");
        }
        for id in ["", "a/b", "a b", "../x", &"x".repeat(65)] {
            assert!(!is_secret_id(id), "{id}");
        }
    }
}
