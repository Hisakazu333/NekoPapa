use super::*;
use serde_json::json;

fn memory() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    migrate(&mut conn).unwrap();
    conn
}

fn thread(id: &str, updated: i64, texts: &[&str]) -> Value {
    json!({
        "id": id, "title": format!("{id} 的聊天"), "updatedAt": updated, "messageAt": {},
        "messages": texts.iter().enumerate().map(|(index, text)| json!({
            "id": format!("{id}-{index}"), "role": if index % 2 == 0 { "user" } else { "assistant" },
            "parts": [{ "type": "reasoning", "text": "不应被索引的推理" }, { "type": "text", "text": text }],
        })).collect::<Vec<_>>(),
    })
}

fn envelope(threads: Vec<Value>) -> String {
    json!({ "version": 1, "legacyMigrated": true, "threads": threads }).to_string()
}

fn count(conn: &Connection, sql: &str) -> i64 {
    conn.query_row(sql, [], |row| row.get(0)).unwrap()
}

#[test]
fn round_trips_the_envelope_in_order() {
    let mut conn = memory();
    assert_eq!(read_envelope(&conn).unwrap(), None);
    let saved = envelope(vec![
        thread("b", 2, &["你好"]),
        thread("a", 1, &["hi", "there"]),
    ]);
    save_envelope(&mut conn, &saved).unwrap();
    let read: Value = serde_json::from_str(&read_envelope(&conn).unwrap().unwrap()).unwrap();
    assert_eq!(read, serde_json::from_str::<Value>(&saved).unwrap());
    assert_eq!(count(&conn, "SELECT COUNT(*) FROM chat_messages"), 3);
}

#[test]
fn rewrites_only_changed_threads_and_removes_missing_ones() {
    let mut conn = memory();
    save_envelope(
        &mut conn,
        &envelope(vec![
            thread("a", 1, &["一号"]),
            thread("b", 1, &["二号"]),
            thread("c", 1, &["三号"]),
        ]),
    )
    .unwrap();
    // Mark rows so an untouched thread can be told apart from a rewritten one.
    conn.execute(
        "UPDATE chat_messages SET seq = 99 WHERE thread_id = 'a'",
        [],
    )
    .unwrap();
    save_envelope(
        &mut conn,
        &envelope(vec![
            thread("b", 2, &["二号", "新的回复"]),
            thread("a", 1, &["一号"]),
        ]),
    )
    .unwrap();
    assert_eq!(
        count(&conn, "SELECT seq FROM chat_messages WHERE thread_id = 'a'"),
        99,
        "unchanged thread is not rewritten"
    );
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM chat_messages WHERE thread_id = 'b'"
        ),
        2
    );
    assert_eq!(
        count(&conn, "SELECT COUNT(*) FROM chat_threads WHERE id = 'c'"),
        0
    );
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM chat_search WHERE thread_id = 'c'"
        ),
        0
    );
    let order: Vec<String> = conn
        .prepare("SELECT id FROM chat_threads ORDER BY position")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(order, ["b", "a"]);
}

#[test]
fn an_invalid_save_changes_nothing() {
    let mut conn = memory();
    let good = envelope(vec![thread("a", 1, &["保留"])]);
    save_envelope(&mut conn, &good).unwrap();
    for bad in [
        "{nope",
        "[]",
        "{\"threads\":{}}",
        &envelope(vec![thread("x", 1, &["x"]), thread("x", 1, &["y"])]),
        &envelope(vec![json!({ "id": "", "updatedAt": 1 })]),
    ] {
        assert_eq!(save_envelope(&mut conn, bad).unwrap_err(), INVALID, "{bad}");
    }
    assert_eq!(
        read_envelope(&conn).unwrap().unwrap(),
        serde_json::from_str::<Value>(&good).unwrap().to_string()
    );
}

#[test]
fn searches_all_message_text_but_not_reasoning() {
    let mut conn = memory();
    let long = format!("{}在最开头提到了量子纠缠", "填充内容".repeat(2000));
    save_envelope(
        &mut conn,
        &envelope(vec![
            thread("old", 1, &[&long, "后面的回复"]),
            thread("new", 2, &["PPO 是一种强化学习算法", "Clip objective"]),
        ]),
    )
    .unwrap();
    let hits = search(&conn, "量子纠缠", 10).unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(
        (hits[0].thread_id.as_str(), hits[0].message_id.as_str()),
        ("old", "old-0")
    );
    assert!(hits[0].snippet.contains("量子纠缠") && hits[0].snippet.starts_with('…'));
    assert_eq!(
        search(&conn, "clip OBJECTIVE", 10).unwrap()[0].thread_id,
        "new",
        "case-insensitive, all terms"
    );
    assert_eq!(
        search(&conn, "强化", 10).unwrap()[0].thread_id,
        "new",
        "two characters use LIKE"
    );
    assert!(search(&conn, "推理", 10).unwrap().is_empty());
    assert!(search(&conn, "100%", 10).unwrap().is_empty());
    assert!(search(&conn, "  ", 10).unwrap().is_empty());
    assert!(search(&conn, "\"quoted\" 量子", 10).unwrap().is_empty());
}

#[test]
fn imports_the_json_file_once_and_keeps_it_as_a_backup() {
    let dir = std::env::temp_dir().join(format!(
        "nekopapa-chat-db-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&dir).unwrap();
    let mut conn = open(&dir.join(DATABASE_FILE)).unwrap();
    import_legacy(&mut conn, &dir).unwrap();
    assert_eq!(read_envelope(&conn).unwrap(), None, "nothing to import");

    fs::write(dir.join(LEGACY_FILE), "{broken").unwrap();
    assert!(import_legacy(&mut conn, &dir)
        .unwrap_err()
        .contains("原文件保持不变"));
    assert!(dir.join(LEGACY_FILE).exists());

    let legacy = envelope(vec![thread("kept", 5, &["迁移前的消息"])]);
    fs::write(dir.join(LEGACY_FILE), &legacy).unwrap();
    import_legacy(&mut conn, &dir).unwrap();
    assert!(!dir.join(LEGACY_FILE).exists());
    assert_eq!(
        fs::read_to_string(dir.join(format!("{LEGACY_FILE}.migrated"))).unwrap(),
        legacy
    );
    assert_eq!(
        search(&conn, "迁移前的消息", 5).unwrap()[0].thread_id,
        "kept"
    );

    // A stray file appearing later does not replace history already in the database.
    fs::write(dir.join(LEGACY_FILE), envelope(vec![])).unwrap();
    import_legacy(&mut conn, &dir).unwrap();
    assert!(read_envelope(&conn).unwrap().unwrap().contains("kept"));
    drop(conn);
    // Reopening applies no migration twice.
    let conn = open(&dir.join(DATABASE_FILE)).unwrap();
    assert_eq!(count(&conn, "SELECT COUNT(*) FROM schema_migrations"), 1);
    fs::remove_dir_all(dir).unwrap();
}
