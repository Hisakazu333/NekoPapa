use super::*;

fn temp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "nekopapa-agent-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
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
    assert_eq!(
        (change.created, change.added, change.removed),
        (false, 1, 1)
    );
    assert!(change.diff.contains("-two\n+TWO\n"));
    let created = write(&store, base, "src/new/b.ts", "export {};\n").unwrap();
    assert!(created.created);
    assert_eq!(
        fs::read_to_string(root.join("src/new/b.ts")).unwrap(),
        "export {};\n"
    );

    assert_eq!(snapshot_state(&store, &change.snapshot).unwrap(), "ready");
    undo(&store, &change.snapshot).unwrap();
    assert_eq!(
        fs::read_to_string(root.join("a.txt")).unwrap(),
        "one\ntwo\n"
    );
    assert_eq!(snapshot_state(&store, &change.snapshot).unwrap(), "undone");
    assert!(undo(&store, &change.snapshot)
        .unwrap_err()
        .contains("撤销过"));
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
    assert!(undo(&store, &change.snapshot)
        .unwrap_err()
        .contains("又被改动"));
    assert_eq!(
        fs::read_to_string(root.join("a.txt")).unwrap(),
        "someone else\n"
    );
    fs::remove_dir_all(root).unwrap();
    fs::remove_dir_all(store).unwrap();
}

fn one(old: &str, new: &str) -> Vec<Replacement> {
    vec![Replacement {
        old: old.into(),
        new: new.into(),
        replace_all: false,
    }]
}

#[test]
fn edits_only_a_unique_match() {
    let (root, store) = (temp("edit"), temp("store"));
    let base = root.to_str().unwrap();
    fs::write(root.join("a.ts"), "let x = 1;\nlet y = 1;\n").unwrap();
    assert!(edit(&store, base, "a.ts", &one("= 1;", "= 2;"))
        .unwrap_err()
        .contains("2 次"));
    assert!(edit(&store, base, "a.ts", &one("missing", "z"))
        .unwrap_err()
        .contains("找不到"));
    let change = edit(&store, base, "a.ts", &one("let y = 1;", "let y = 2;")).unwrap();
    assert_eq!((change.added, change.removed), (1, 1));
    assert_eq!(
        fs::read_to_string(root.join("a.ts")).unwrap(),
        "let x = 1;\nlet y = 2;\n"
    );
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
    assert!(write(&store, base, "big.txt", &"x".repeat(MAX_WRITE + 1))
        .unwrap_err()
        .contains("2 MB"));
    fs::remove_dir_all(root).unwrap();
    fs::remove_dir_all(store).unwrap();
    fs::remove_dir_all(outside).unwrap();
}

#[test]
fn applies_several_edits_as_one_change_or_none() {
    let (root, store) = (temp("multi"), temp("store"));
    let base = root.to_str().unwrap();
    fs::write(root.join("a.ts"), "a = 1;\nb = 1;\nc = 1;\n").unwrap();
    let all = |old: &str, new: &str| Replacement {
        old: old.into(),
        new: new.into(),
        replace_all: true,
    };
    let edits = vec![
        Replacement {
            old: "a = 1;".into(),
            new: "a = 2;".into(),
            replace_all: false,
        },
        all("= 1;", "= 3;"),
    ];
    let change = edit(&store, base, "a.ts", &edits).unwrap();
    assert_eq!(
        fs::read_to_string(root.join("a.ts")).unwrap(),
        "a = 2;\nb = 3;\nc = 3;\n"
    );
    assert_eq!((change.added, change.removed), (3, 3));
    // The second edit fails: nothing is written, and the error names it.
    let failing = vec![
        all("= 3;", "= 4;"),
        Replacement {
            old: "missing".into(),
            new: "x".into(),
            replace_all: false,
        },
    ];
    assert!(edit(&store, base, "a.ts", &failing)
        .unwrap_err()
        .contains("第 2 处"));
    assert_eq!(
        fs::read_to_string(root.join("a.ts")).unwrap(),
        "a = 2;\nb = 3;\nc = 3;\n"
    );
    assert!(edit(&store, base, "a.ts", &[]).is_err());
    undo(&store, &change.snapshot).unwrap();
    assert_eq!(
        fs::read_to_string(root.join("a.ts")).unwrap(),
        "a = 1;\nb = 1;\nc = 1;\n"
    );
    fs::remove_dir_all(root).unwrap();
    fs::remove_dir_all(store).unwrap();
}
