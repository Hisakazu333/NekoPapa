use super::*;
use crate::memory_config::{companion_ref, LOCAL_USER, SHARED};

#[test]
fn spaces_are_shared_or_one_person() {
    assert!(check_scope(SHARED).is_ok());
    assert!(check_scope("contact:luna-01").is_ok());
    assert!(check_scope("contact:").is_err());
    assert!(check_scope("contact:../x").is_err());
    assert!(check_scope("contact:a b").is_err());
    assert!(check_scope(&format!("contact:{}", "a".repeat(121))).is_err());
    assert!(check_scope("official:luna").is_err());
    assert_eq!(companion_ref(SHARED), "nekopapa.shared");
    assert_eq!(companion_ref("contact:luna-01"), "nekopapa.contact.luna-01");
}

#[test]
fn only_page_operations_pass() {
    for operation in ["entries.list", "entries.write", "forget.plan", "forget.apply", "writes.cancel", "consent"] {
        assert!(check_operation(operation).is_ok(), "{operation}");
    }
    for operation in ["ingest", "recall", "data.export", "admin.purge", ""] {
        assert!(check_operation(operation).is_err(), "{operation}");
    }
}

#[test]
fn every_space_gets_its_own_token_slot() {
    let scopes = vec![SHARED.to_string(), "contact:luna".to_string()];
    let config = service_config("/data/memory.sqlite", &scopes).unwrap();
    let auth = config["auth"].as_array().unwrap();
    assert_eq!(auth.len(), 2);
    assert_eq!(auth[0]["token_env"], "NEKOPAPA_MEMORY_TOKEN_0");
    assert_eq!(auth[1]["token_env"], "NEKOPAPA_MEMORY_TOKEN_1");
    assert_eq!(auth[1]["scope"]["companion_ref"], "nekopapa.contact.luna");
    assert_eq!(auth[0]["scope"]["user_id"], LOCAL_USER);
    assert_eq!(config["profiles"]["main"]["storage"]["path"], "/data/memory.sqlite");
    // No token is ever written into the file.
    assert!(!config.to_string().contains("\"token\""));
    assert!(service_config("/x", &[]).is_err());
}

#[test]
fn replies_become_results_or_sentences() {
    let ok = read_reply(200, r#"{"ok":true,"result":{"total":3},"usage":{}}"#).unwrap();
    assert_eq!(ok["total"], 3);
    let failed = read_reply(409, r#"{"ok":false,"error":{"code":"stale_revision","message":"记忆已变化","retryable":true}}"#);
    assert_eq!(failed.unwrap_err(), "记忆服务：记忆已变化（stale_revision）");
    assert!(read_reply(502, "<html>").unwrap_err().contains("HTTP 502"));
}

#[test]
fn tokens_are_random_hex() {
    let first = random_token().unwrap();
    assert_eq!(first.len(), 64);
    assert!(first.chars().all(|c| c.is_ascii_hexdigit()));
    assert_ne!(first, random_token().unwrap());
}

#[test]
fn log_tail_keeps_the_end_on_char_boundaries() {
    let long = format!("{}结尾", "记".repeat(2000));
    let kept = tail(&long);
    assert!(kept.ends_with("结尾"));
    assert!(kept.chars().count() <= LOG_TAIL + 1);
    assert_eq!(tail("  short  "), "short");
}

