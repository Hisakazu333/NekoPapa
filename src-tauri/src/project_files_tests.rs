use super::*;
use std::path::PathBuf;

fn temp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "nekopapa-files-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&dir).unwrap();
    fs::canonicalize(dir).unwrap()
}

fn text<'a>(text: &'a str) -> Query<'a> {
    Query {
        text,
        regex: false,
        case_sensitive: false,
        path_pattern: None,
    }
}

fn project() -> PathBuf {
    let root = temp("search");
    fs::create_dir_all(root.join("src/lib")).unwrap();
    fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
    fs::write(root.join("src/app.ts"), "const Theme = 1;\nother\n").unwrap();
    fs::write(root.join("src/theme.css"), "body {}\n").unwrap();
    fs::write(root.join("src/lib/util.ts"), "export function theme() {}\n").unwrap();
    fs::write(root.join("README.md"), "# Theme\n").unwrap();
    fs::write(root.join("node_modules/pkg/index.js"), "theme\n").unwrap();
    root
}

#[test]
fn searches_text_and_paths_but_skips_dependencies() {
    let root = project();
    let base = root.to_str().unwrap();
    let found = search(base, &text("theme"), 50).unwrap();
    assert_eq!(
        found.hits,
        vec![
            Hit {
                path: "README.md".into(),
                line: 1,
                text: "# Theme".into()
            },
            Hit {
                path: "src/app.ts".into(),
                line: 1,
                text: "const Theme = 1;".into()
            },
            Hit {
                path: "src/theme.css".into(),
                line: 0,
                text: String::new()
            },
            Hit {
                path: "src/lib/util.ts".into(),
                line: 1,
                text: "export function theme() {}".into()
            },
        ]
    );
    assert!(!found.truncated);
    assert!(search(base, &text("theme"), 1).unwrap().truncated);
    assert!(search(base, &text("  "), 5).is_err());
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn searches_by_regex_case_and_path() {
    let root = project();
    let base = root.to_str().unwrap();
    let regex = Query {
        text: r"function\s+\w+\(",
        regex: true,
        case_sensitive: false,
        path_pattern: None,
    };
    assert_eq!(search(base, &regex, 50).unwrap().hits.len(), 1);
    let exact = Query {
        text: "Theme",
        regex: false,
        case_sensitive: true,
        path_pattern: None,
    };
    let hits = search(base, &exact, 50).unwrap().hits;
    assert_eq!(
        hits.iter().map(|hit| hit.path.as_str()).collect::<Vec<_>>(),
        vec!["README.md", "src/app.ts"]
    );
    let scoped = Query {
        text: "theme",
        regex: false,
        case_sensitive: false,
        path_pattern: Some(r"^src/lib/"),
    };
    assert_eq!(
        search(base, &scoped, 50).unwrap().hits,
        vec![Hit {
            path: "src/lib/util.ts".into(),
            line: 1,
            text: "export function theme() {}".into()
        }]
    );
    let bad = Query {
        text: "(",
        regex: true,
        case_sensitive: false,
        path_pattern: None,
    };
    assert!(search(base, &bad, 5).unwrap_err().contains("正则"));
    // Literal text with regex characters is matched as written.
    fs::write(root.join("src/q.ts"), "a.b(c)\n").unwrap();
    assert_eq!(search(base, &text("a.b(c)"), 50).unwrap().hits.len(), 1);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn indexes_every_file_but_dependencies() {
    let root = project();
    let found = index(root.to_str().unwrap()).unwrap();
    assert_eq!(
        found.paths,
        vec![
            "README.md",
            "src/app.ts",
            "src/theme.css",
            "src/lib/util.ts"
        ]
    );
    assert!(!found.truncated);
    assert!(index("relative/path").is_err());
    fs::remove_dir_all(root).unwrap();
}
