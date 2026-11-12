use super::*;

fn temp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "nekopapa-data-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    ensure_layout(&dir).unwrap();
    dir
}

#[test]
fn creates_the_layout_and_round_trips_a_store() {
    let root = temp("layout");
    for section in SECTIONS {
        assert!(root.join(section).is_dir(), "{section}");
    }
    assert_eq!(read_stores(&root).unwrap(), vec![]);
    write_store(&root, "chat-threads", "{\"version\":1}").unwrap();
    write_store(&root, "chat-threads", "{\"version\":1,\"threads\":[]}").unwrap();
    assert_eq!(read_stores(&root).unwrap(), vec![StoreFile { name: "chat-threads".into(), text: "{\"version\":1,\"threads\":[]}".into() }]);
    // No temporary file is left beside the store.
    let names: Vec<_> = fs::read_dir(root.join("data")).unwrap().flatten().map(|entry| entry.file_name()).collect();
    assert_eq!(names, vec![std::ffi::OsString::from("chat-threads.json")]);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn refuses_unknown_names_and_paths() {
    let root = temp("names");
    for name in ["settings", "../chat-threads", "data/chat-threads", ""] {
        assert!(write_store(&root, name, "{}").unwrap_err().contains("未知"), "{name}");
    }
    assert!(!root.join("chat-threads.json").exists());
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_failed_write_keeps_the_old_file() {
    let root = temp("fail");
    write_store(&root, "chat-threads", "old").unwrap();
    assert!(write_store(&root, "chat-threads", &"x".repeat(MAX_STORE + 1)).unwrap_err().contains("64 MB"));
    assert_eq!(fs::read_to_string(root.join("data/chat-threads.json")).unwrap(), "old");
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn reports_sizes_and_clears_only_the_cache() {
    let root = temp("cache");
    write_store(&root, "chat-threads", "12345").unwrap();
    fs::create_dir_all(root.join("cache/icons")).unwrap();
    fs::write(root.join("cache/icons/a.png"), [0u8; 10]).unwrap();
    fs::write(root.join("cache/models.json"), "abc").unwrap();
    let outside = temp("outside");
    fs::write(outside.join("keep.txt"), "keep").unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, root.join("cache/link")).unwrap();

    let usage = info(&root);
    let section = |id: &str| usage.sections.iter().find(|section| section.id == id).unwrap();
    assert_eq!((section("data").bytes, section("data").files), (5, 1));
    assert_eq!(section("cache").files, if cfg!(unix) { 3 } else { 2 });

    clear_cache(&root).unwrap();
    assert!(root.join("cache").is_dir());
    assert_eq!(fs::read_dir(root.join("cache")).unwrap().count(), 0);
    assert_eq!(fs::read_to_string(root.join("data/chat-threads.json")).unwrap(), "12345");
    assert_eq!(fs::read_to_string(outside.join("keep.txt")).unwrap(), "keep");
    fs::remove_dir_all(root).unwrap();
    fs::remove_dir_all(outside).unwrap();
}
