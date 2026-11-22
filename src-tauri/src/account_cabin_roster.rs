//! Account-scoped companion roster and eligibility for a read-only preview.
use super::{authorized, companion_identity, lock, main_view, text, AccountAuth, Session};
use reqwest::Method;
use serde::Serialize;
use serde_json::Value;
use tauri::{Runtime, State, Webview};

pub(super) const ROSTER: &str = "/api/app/companion/roster";

pub(super) fn level(profile: &Value) -> Option<u64> {
    profile["level"]
        .as_u64()
        .filter(|level| (1..=u32::MAX.into()).contains(level))
}

pub(super) fn affinity(profile: &Value) -> Option<u64> {
    profile["affinity"].as_u64().filter(|value| *value <= 100)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Companion {
    key: String,
    name: String,
    level: Option<u64>,
    affinity: Option<u64>,
    current: bool,
    available: bool,
}

fn owned_row(profile: &Value, owner: u64) -> bool {
    profile["userId"].as_u64() == Some(owner) && profile["status"] == "ACTIVE"
}

fn companion(profile: &Value, owner: u64) -> Option<Companion> {
    if !owned_row(profile, owner) {
        return None;
    }
    Some(Companion {
        key: companion_identity(profile).ok()?.to_owned(),
        name: text(profile, "displayName").ok()?.to_owned(),
        level: level(profile),
        affinity: affinity(profile),
        current: profile["isCurrent"] == true,
        available: profile["canSwitch"] == true,
    })
}

async fn fetch_roster(auth: &AccountAuth, session: &Session) -> Result<Vec<Value>, String> {
    let mut response = authorized(auth, session, Method::GET, ROSTER, None).await?;
    match response["items"].take() {
        Value::Array(items) => Ok(items),
        _ => Err("同伴名册格式无效。".into()),
    }
}

fn eligible(profile: &Value, owner: u64, key: &str) -> bool {
    owned_row(profile, owner)
        && companion_identity(profile).is_ok_and(|id| id == key)
        && profile["canSwitch"] == true
}

pub(super) async fn preview_profile(
    auth: &AccountAuth,
    session: &Session,
    key: &str,
) -> Result<Value, String> {
    let items = fetch_roster(auth, session).await?;
    items
        .into_iter()
        .find(|profile| eligible(profile, session.profile.user_id, key))
        .ok_or_else(|| "该同伴暂不可预览，请刷新同伴名册。".into())
}

#[tauri::command]
pub async fn account_cabin_roster<R: Runtime>(
    webview: Webview<R>,
    auth: State<'_, AccountAuth>,
) -> Result<Vec<Companion>, String> {
    main_view(&webview)?;
    let session = lock(&auth)?.session.clone().ok_or("请先登录 NekoPapa。")?;
    Ok(fetch_roster(&auth, &session)
        .await?
        .iter()
        .filter_map(|profile| companion(profile, session.profile.user_id))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn roster_only_exposes_public_fields_and_preview_requires_owned_available_identity() {
        let mut row = json!({"userId":7, "status":"ACTIVE", "canSwitch":true, "identityKey":"OFFICIAL:cat_006",
            "companionMode":"OFFICIAL", "companionRef":"cat_006", "displayName":"Fixture",
            "affinity":38, "level":2, "promptText":"private"});
        let record = serde_json::to_value(companion(&row, 7).unwrap()).unwrap();
        assert_eq!(
            record,
            json!({"key":"OFFICIAL:cat_006", "name":"Fixture", "affinity":38,
            "level":2, "available":true, "current":false})
        );
        assert!(eligible(&row, 7, "OFFICIAL:cat_006"));
        assert!(!eligible(&row, 8, "OFFICIAL:cat_006"));
        assert!(!eligible(&row, 7, "OFFICIAL:cat_002"));
        row["canSwitch"] = json!(false);
        assert!(!eligible(&row, 7, "OFFICIAL:cat_006"));
    }
}
