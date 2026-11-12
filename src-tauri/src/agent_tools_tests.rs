use super::*;

fn temp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "nekopapa-agent-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    fs::create_dir_all(&dir).unwrap();
    fs::canonicalize(dir).unwrap()
}

#[test]
fn writes_new_and_existing_files_and_undoes_them() {
    let (root, store) = (temp("write"), temp("store"));
    let base = root.to_str().unwrap();
    fs::write(root.join("a.txt"), "one\ntwo\n").unwrap();

    let change = write(&store, base, "a.txt", "one\nTWO\n").unwrap();
    assert_eq!((change.created, change.added, change.removed), (false, 1, 1));
    assert!(change.diff.contains("-two\n+TWO\n"));
    let created = write(&store, base, "src/new/b.ts", "export {};\n").unwrap();
    assert!(created.created);
    assert_eq!(fs::read_to_string(root.join("src/new/b.ts")).unwrap(), "export {};\n");

    assert_eq!(snapshot_state(&store, &change.snapshot).unwrap(), "ready");
    undo(&store, &change.snapshot).unwrap();
    assert_eq!(fs::read_to_string(root.join("a.txt")).unwrap(), "one\ntwo\n");
    assert_eq!(snapshot_state(&store, &change.snapshot).unwrap(), "undone");
    assert!(undo(&store, &change.snapshot).unwrap_err().contains("撤销过"));
    undo(&store, &created.snapshot).unwrap();
    assert!(!root.join("src/new/b.ts").exists());
    fs::remove_dir_all(root).unwrap();
    fs::remove_dir_all(store).unwrap();
}

#[test]
fn undo_refuses_when_the_file_changed_again() {
    let (root, store) = (temp("changed"), temp("store"));
    let base = root.to_str().unwrap();
    let change = write(&store, base, "a.txt", "agent\n").unwrap();
    fs::write(root.join("a.txt"), "someone else\n").unwrap();
    assert_eq!(snapshot_state(&store, &change.snapshot).unwrap(), "changed");
    assert!(undo(&store, &change.snapshot).unwrap_err().contains("又被改动"));
    assert_eq!(fs::read_to_string(root.join("a.txt")).unwrap(), "someone else\n");
    fs::remove_dir_all(root).unwrap();
    fs::remove_dir_all(store).unwrap();
}

#[test]
fn edits_only_a_unique_match() {
    let (root, store) = (temp("edit"), temp("store"));
    let base = root.to_str().unwrap();
    fs::write(root.join("a.ts"), "let x = 1;\nlet y = 1;\n").unwrap();
    assert!(edit(&store, base, "a.ts", "= 1;", "= 2;").unwrap_err().contains("2 次"));
    assert!(edit(&store, base, "a.ts", "missing", "z").unwrap_err().contains("找不到"));
    let change = edit(&store, base, "a.ts", "let y = 1;", "let y = 2;").unwrap();
    assert_eq!((change.added, change.removed), (1, 1));
    assert_eq!(fs::read_to_string(root.join("a.ts")).unwrap(), "let x = 1;\nlet y = 2;\n");
    fs::remove_dir_all(root).unwrap();
    fs::remove_dir_all(store).unwrap();
}

#[test]
fn refuses_paths_outside_the_project_and_bad_snapshot_ids() {
    let (root, store, outside) = (temp("escape"), temp("store"), temp("outside"));
    let base = root.to_str().unwrap();
    for path in ["../x.txt", "/etc/hosts", "", "a/../../x"] {
        assert!(write(&store, base, path, "x").is_err(), "{path}");
    }
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&outside, root.join("link")).unwrap();
        assert!(write(&store, base, "link/x.txt", "x").is_err());
        assert!(!outside.join("x.txt").exists());
    }
    assert!(snapshot_state(&store, "../../etc").is_err());
    assert!(write(&store, base, "big.txt", &"x".repeat(MAX_WRITE + 1)).unwrap_err().contains("2 MB"));
    fs::remove_dir_all(root).unwrap();
    fs::remove_dir_all(store).unwrap();
    fs::remove_dir_all(outside).unwrap();
}

#[test]
fn searches_text_and_paths_but_skips_dependencies() {
    let root = temp("search");
    let base = root.to_str().unwrap();
    fs::create_dir_all(root.join("src")).unwrap();
    fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
    fs::write(root.join("src/app.ts"), "const Theme = 1;\nother\n").unwrap();
    fs::write(root.join("src/theme.css"), "body {}\n").unwrap();
    fs::write(root.join("node_modules/pkg/index.js"), "theme\n").unwrap();
    let found = search(base, "theme", 50).unwrap();
    assert_eq!(found.hits, vec![
        Hit { path: "src/app.ts".into(), line: 1, text: "const Theme = 1;".into() },
        Hit { path: "src/theme.css".into(), line: 0, text: String::new() },
    ]);
    assert!(!found.truncated);
    assert!(search(base, "theme", 1).unwrap().truncated);
    assert!(search(base, "  ", 5).is_err());
    fs::remove_dir_all(root).unwrap();
}
