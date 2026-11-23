use super::*;

fn temp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "nekopapa-data-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    ensure_layout(&dir).unwrap();
    dir
}

fn database(root: &Path) -> Connection {
    chat_db::open(&root.join("data").join(chat_db::DATABASE_FILE)).unwrap()
}

#[test]
fn creates_the_layout_and_round_trips_the_chat_store() {
    let root = temp("layout");
    for section in SECTIONS {
        assert!(root.join(section).is_dir(), "{section}");
    }
    let mut conn = database(&root);
    assert_eq!(read_stores(&conn).unwrap(), vec![]);
    write_store(&mut conn, "chat-threads", "{\"version\":1,\"threads\":[]}").unwrap();
    assert_eq!(
        read_stores(&conn).unwrap(),
        vec![StoreFile {
            name: "chat-threads".into(),
            text: "{\"threads\":[],\"version\":1}".into()
        }]
    );
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn refuses_unknown_names_and_oversized_history() {
    let root = temp("names");
    let mut conn = database(&root);
    for name in ["settings", "../chat-threads", "data/chat-threads", ""] {
        assert!(
            write_store(&mut conn, name, "{}")
                .unwrap_err()
                .contains("未知"),
            "{name}"
        );
    }
    assert!(
        write_store(&mut conn, "chat-threads", &"x".repeat(MAX_STORE + 1))
            .unwrap_err()
            .contains("64 MB")
    );
    assert_eq!(read_stores(&conn).unwrap(), vec![]);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn reports_sizes_and_clears_only_the_cache() {
    let root = temp("cache");
    fs::write(root.join("data/workspace.sqlite"), "12345").unwrap();
    fs::create_dir_all(root.join("cache/icons")).unwrap();
    fs::write(root.join("cache/icons/a.png"), [0u8; 10]).unwrap();
    fs::write(root.join("cache/models.json"), "abc").unwrap();
    let outside = temp("outside");
    fs::write(outside.join("keep.txt"), "keep").unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, root.join("cache/link")).unwrap();

    let usage = info(&root);
    let section = |id: &str| {
        usage
            .sections
            .iter()
            .find(|section| section.id == id)
            .unwrap()
    };
    assert_eq!((section("data").bytes, section("data").files), (5, 1));
    assert_eq!(section("cache").files, if cfg!(unix) { 3 } else { 2 });

    clear_cache(&root).unwrap();
    assert!(root.join("cache").is_dir());
    assert_eq!(fs::read_dir(root.join("cache")).unwrap().count(), 0);
    assert_eq!(
        fs::read_to_string(root.join("data/workspace.sqlite")).unwrap(),
        "12345"
    );
    assert_eq!(
        fs::read_to_string(outside.join("keep.txt")).unwrap(),
        "keep"
    );
    fs::remove_dir_all(root).unwrap();
    fs::remove_dir_all(outside).unwrap();
}
