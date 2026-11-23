//! Chat history in the local database (`data/workspace.sqlite`, see
//! docs/local-data-model.md). Each thread's full JSON is the authoritative
//! record (`chat_threads.data`), in the same shape the front end already
//! reads and writes (`{ version, legacyMigrated, threads }`), so its read
//! gate, merging and retries stay as they are. The text of each message is
//! copied into `chat_messages` and a full-text index (`chat_search`) in the
//! same transaction; both are derived and rebuilt from `data`.

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

/// Schema steps, applied in order inside one transaction each. Append only.
const MIGRATIONS: &[&str] = &[r#"
    CREATE TABLE chat_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE chat_threads (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL,
        title TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        contact_id TEXT,
        project TEXT,
        data TEXT NOT NULL
    );
    CREATE TABLE chat_messages (
        thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
        message_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        PRIMARY KEY (thread_id, message_id)
    );
    CREATE VIRTUAL TABLE chat_search USING fts5(text, thread_id UNINDEXED, message_id UNINDEXED, tokenize = 'trigram');
"#];

pub const DATABASE_FILE: &str = "workspace.sqlite";
const LEGACY_FILE: &str = "chat-threads.json";
const INVALID: &str = "聊天记录格式无效，未写入。";

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub thread_id: String,
    pub message_id: String,
    pub snippet: String,
}

fn db_error(error: rusqlite::Error) -> String {
    format!("本机数据库出错：{error}")
}

/// Opens (or creates) the database and brings its schema up to date.
pub fn open(path: &Path) -> Result<Connection, String> {
    let mut conn = Connection::open(path).map_err(|_| "无法打开本机数据库。".to_string())?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;",
    )
    .map_err(db_error)?;
    migrate(&mut conn)?;
    Ok(conn)
}

fn migrate(conn: &mut Connection) -> Result<(), String> {
    conn.execute_batch("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);").map_err(db_error)?;
    let current: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .map_err(db_error)?;
    if current > MIGRATIONS.len() as i64 {
        return Err("本机数据库来自更新的版本，请升级 NekoPapa 后再打开。".into());
    }
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(current as usize) {
        let tx = conn.transaction().map_err(db_error)?;
        tx.execute_batch(sql).map_err(db_error)?;
        tx.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (?1, strftime('%s', 'now'))", params![index as i64 + 1]).map_err(db_error)?;
        tx.commit().map_err(db_error)?;
    }
    Ok(())
}

/// The stored history as the front end's envelope, or None when nothing was ever saved.
pub fn read_envelope(conn: &Connection) -> Result<Option<String>, String> {
    let meta: Option<String> = conn
        .query_row(
            "SELECT value FROM chat_meta WHERE key = 'envelope'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(db_error)?;
    let Some(meta) = meta else { return Ok(None) };
    let mut envelope: Map<String, Value> =
        serde_json::from_str(&meta).map_err(|_| "本机数据库中的聊天记录无法读取。".to_string())?;
    let mut statement = conn
        .prepare("SELECT data FROM chat_threads ORDER BY position")
        .map_err(db_error)?;
    let threads = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(db_error)?
        .map(|data| {
            data.map_err(db_error).and_then(|data| {
                serde_json::from_str::<Value>(&data)
                    .map_err(|_| "本机数据库中的聊天记录无法读取。".to_string())
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    envelope.insert("threads".into(), Value::Array(threads));
    Ok(Some(Value::Object(envelope).to_string()))
}

/// Text of a message's text parts, as the transcript shows it.
fn message_text(message: &Value) -> String {
    message["parts"]
        .as_array()
        .map(|parts| {
            parts
                .iter()
                .filter(|part| part["type"] == "text")
                .filter_map(|part| part["text"].as_str())
                .collect::<String>()
        })
        .unwrap_or_default()
}

fn index_thread(tx: &Transaction, id: &str, thread: &Value) -> Result<(), String> {
    tx.execute(
        "DELETE FROM chat_messages WHERE thread_id = ?1",
        params![id],
    )
    .map_err(db_error)?;
    tx.execute("DELETE FROM chat_search WHERE thread_id = ?1", params![id])
        .map_err(db_error)?;
    for (seq, message) in thread["messages"]
        .as_array()
        .into_iter()
        .flatten()
        .enumerate()
    {
        let (Some(message_id), Some(role)) = (message["id"].as_str(), message["role"].as_str())
        else {
            return Err(INVALID.into());
        };
        let text = message_text(message);
        tx.execute("INSERT INTO chat_messages (thread_id, message_id, seq, role, text) VALUES (?1, ?2, ?3, ?4, ?5)", params![id, message_id, seq as i64, role, text]).map_err(db_error)?;
        if !text.trim().is_empty() {
            tx.execute(
                "INSERT INTO chat_search (text, thread_id, message_id) VALUES (?1, ?2, ?3)",
                params![text, id, message_id],
            )
            .map_err(db_error)?;
        }
    }
    Ok(())
}

/// Saves the whole history in one transaction. Threads whose JSON did not
/// change are not rewritten; changed ones are replaced and re-indexed;
/// threads no longer present are removed.
pub fn save_envelope(conn: &mut Connection, text: &str) -> Result<(), String> {
    let Ok(Value::Object(mut envelope)) = serde_json::from_str::<Value>(text) else {
        return Err(INVALID.into());
    };
    let Some(Value::Array(threads)) = envelope.remove("threads") else {
        return Err(INVALID.into());
    };
    let tx = conn.transaction().map_err(db_error)?;
    tx.execute("INSERT INTO chat_meta (key, value) VALUES ('envelope', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value", params![Value::Object(envelope).to_string()]).map_err(db_error)?;
    let stored: HashMap<String, (i64, String)> = {
        let mut statement = tx
            .prepare("SELECT id, position, data FROM chat_threads")
            .map_err(db_error)?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    (row.get::<_, i64>(1)?, row.get::<_, String>(2)?),
                ))
            })
            .map_err(db_error)?;
        rows.collect::<Result<_, _>>().map_err(db_error)?
    };
    let mut kept = HashSet::new();
    for (position, thread) in threads.iter().enumerate() {
        let id = thread["id"]
            .as_str()
            .filter(|id| !id.is_empty())
            .ok_or(INVALID)?;
        if !kept.insert(id.to_string()) {
            return Err(INVALID.into());
        }
        let data = thread.to_string();
        match stored.get(id) {
            Some((at, old)) if *old == data => {
                if *at != position as i64 {
                    tx.execute(
                        "UPDATE chat_threads SET position = ?2 WHERE id = ?1",
                        params![id, position as i64],
                    )
                    .map_err(db_error)?;
                }
            }
            _ => {
                let updated = thread["updatedAt"].as_f64().ok_or(INVALID)? as i64;
                tx.execute(
                    "INSERT INTO chat_threads (id, position, title, updated_at, contact_id, project, data) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                     ON CONFLICT(id) DO UPDATE SET position = excluded.position, title = excluded.title, updated_at = excluded.updated_at,
                       contact_id = excluded.contact_id, project = excluded.project, data = excluded.data",
                    params![id, position as i64, thread["title"].as_str().unwrap_or_default(), updated, thread["contact"]["id"].as_str(), thread["project"].as_str(), data],
                ).map_err(db_error)?;
                index_thread(&tx, id, thread)?;
            }
        }
    }
    for id in stored.keys().filter(|id| !kept.contains(*id)) {
        tx.execute("DELETE FROM chat_search WHERE thread_id = ?1", params![id])
            .map_err(db_error)?;
        tx.execute("DELETE FROM chat_threads WHERE id = ?1", params![id])
            .map_err(db_error)?;
    }
    tx.commit().map_err(db_error)
}

/// First start with a database: imports `data/chat-threads.json` (the file
/// store used before) when the database has no history yet, then renames
/// the file to `.migrated` as a backup. A failed import leaves the file.
pub fn import_legacy(conn: &mut Connection, data_dir: &Path) -> Result<(), String> {
    let legacy = data_dir.join(LEGACY_FILE);
    if !legacy.exists() || read_envelope(conn)?.is_some() {
        return Ok(());
    }
    let text =
        fs::read_to_string(&legacy).map_err(|_| format!("无法读取 {LEGACY_FILE}，已暂停迁移。"))?;
    save_envelope(conn, &text).map_err(|error| {
        format!("{LEGACY_FILE} 未能导入本机数据库（{error}），原文件保持不变。")
    })?;
    fs::rename(&legacy, data_dir.join(format!("{LEGACY_FILE}.migrated")))
        .map_err(|_| format!("聊天记录已导入，但 {LEGACY_FILE} 未能改名为备份。"))
}

/// Messages whose text contains every term, at most one hit per thread,
/// newest thread first for short terms and best match first otherwise.
/// The trigram index needs three characters; shorter terms use LIKE.
pub fn search(conn: &Connection, query: &str, limit: usize) -> Result<Vec<SearchHit>, String> {
    let terms: Vec<&str> = query.split_whitespace().collect();
    if terms.is_empty() {
        return Ok(vec![]);
    }
    let rows: Vec<(String, String, String)> = if terms.iter().all(|term| term.chars().count() >= 3)
    {
        let phrase = terms
            .iter()
            .map(|term| format!("\"{}\"", term.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(" AND ");
        let mut statement = conn.prepare(
            "SELECT s.thread_id, s.message_id, s.text FROM chat_search s WHERE chat_search MATCH ?1 ORDER BY rank LIMIT 200",
        ).map_err(db_error)?;
        let rows = statement
            .query_map(params![phrase], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(db_error)?;
        rows.collect::<Result<_, _>>().map_err(db_error)?
    } else {
        let clause = terms
            .iter()
            .map(|_| "m.text LIKE ? ESCAPE '\\'")
            .collect::<Vec<_>>()
            .join(" AND ");
        let patterns: Vec<String> = terms
            .iter()
            .map(|term| {
                format!(
                    "%{}%",
                    term.replace('\\', "\\\\")
                        .replace('%', "\\%")
                        .replace('_', "\\_")
                )
            })
            .collect();
        let sql = format!("SELECT m.thread_id, m.message_id, m.text FROM chat_messages m JOIN chat_threads t ON t.id = m.thread_id WHERE {clause} ORDER BY t.updated_at DESC, m.seq DESC LIMIT 200");
        let mut statement = conn.prepare(&sql).map_err(db_error)?;
        let rows = statement
            .query_map(rusqlite::params_from_iter(patterns.iter()), |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(db_error)?;
        rows.collect::<Result<_, _>>().map_err(db_error)?
    };
    let mut seen = HashSet::new();
    Ok(rows
        .into_iter()
        .filter(|(thread, _, _)| seen.insert(thread.clone()))
        .take(limit)
        .map(|(thread_id, message_id, text)| SearchHit {
            snippet: snippet(&text, terms[0]),
            thread_id,
            message_id,
        })
        .collect())
}

/// About 60 characters around the first match, on one line.
fn snippet(text: &str, term: &str) -> String {
    let flat: Vec<char> = text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .collect();
    let lower: Vec<char> = flat.iter().flat_map(|c| c.to_lowercase()).collect();
    let needle: Vec<char> = term.chars().flat_map(|c| c.to_lowercase()).collect();
    let at = if lower.len() == flat.len() {
        lower
            .windows(needle.len().max(1))
            .position(|window| window == needle.as_slice())
            .unwrap_or(0)
    } else {
        0
    };
    let start = at.saturating_sub(20);
    let end = (at + needle.len() + 40).min(flat.len());
    let body: String = flat[start..end].iter().collect();
    format!(
        "{}{}{}",
        if start > 0 { "…" } else { "" },
        body,
        if end < flat.len() { "…" } else { "" }
    )
}

#[cfg(test)]
#[path = "chat_db_tests.rs"]
mod tests;
