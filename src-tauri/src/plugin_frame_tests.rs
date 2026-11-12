use super::*;
use crate::plugin_manifest::MANIFEST_FILE;

fn temp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "nekopapa-plugin-frame-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn plugin(name: &str, id: &str) -> PathBuf {
    let dir = temp(name);
    fs::write(dir.join(MANIFEST_FILE), format!("{{\"id\":\"{id}\"}}")).unwrap();
    fs::create_dir_all(dir.join("ui")).unwrap();
    fs::write(dir.join("ui/index.html"), "<p>hi</p>").unwrap();
    dir
}

fn header<'a>(response: &'a Response<Vec<u8>>, name: header::HeaderName) -> &'a str {
    response.headers().get(name).and_then(|value| value.to_str().ok()).unwrap_or_default()
}

#[test]
fn serves_only_allowed_plugins_files_with_their_csp() {
    let dir = plugin("serve", "example.notes");
    let frames = PluginFrames::default();
    assert_eq!(serve(&frames, "/example.notes/ui/index.html", "GET").status(), StatusCode::NOT_FOUND);
    allow(&frames, "example.notes", &dir.to_string_lossy()).unwrap();
    let response = serve(&frames, "/example.notes/ui/index.html", "GET");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.body(), b"<p>hi</p>");
    assert!(header(&response, header::CONTENT_TYPE).starts_with("text/html"));
    let csp = header(&response, header::CONTENT_SECURITY_POLICY);
    assert!(csp.contains("script-src nekopapa-plugin://localhost/example.notes/ nekopapa-plugin://localhost/__sdk/"));
    assert!(csp.contains("connect-src 'none'") && csp.contains("frame-src 'none'") && csp.contains("default-src 'none'"));
    revoke(&frames, "example.notes");
    assert_eq!(serve(&frames, "/example.notes/ui/index.html", "GET").status(), StatusCode::NOT_FOUND);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn allow_checks_the_folder_belongs_to_the_plugin() {
    let dir = plugin("owner", "example.notes");
    let frames = PluginFrames::default();
    assert!(allow(&frames, "example.other", &dir.to_string_lossy()).unwrap_err().contains("不是这个插件"));
    assert!(allow(&frames, "../etc", &dir.to_string_lossy()).is_err());
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn refuses_traversal_hidden_files_unknown_types_and_links_out() {
    let dir = plugin("escape", "example.notes");
    let outside = temp("outside");
    fs::write(outside.join("secret.txt"), "secret").unwrap();
    fs::write(dir.join(".env"), "x").unwrap();
    fs::write(dir.join("run.sh"), "x").unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(outside.join("secret.txt"), dir.join("ui/link.txt")).unwrap();
    let frames = PluginFrames::default();
    allow(&frames, "example.notes", &dir.to_string_lossy()).unwrap();
    for path in [
        "/example.notes/../outside/secret.txt", "/example.notes/%2e%2e/secret.txt", "/example.notes/ui%2Findex.html",
        "/example.notes/.env", "/example.notes/run.sh", "/example.notes/ui/link.txt", "/example.notes/", "/example.notes/ui/missing.html",
    ] {
        assert_eq!(serve(&frames, path, "GET").status(), StatusCode::NOT_FOUND, "{path}");
    }
    assert_eq!(serve(&frames, "/example.notes/ui/index.html", "POST").status(), StatusCode::METHOD_NOT_ALLOWED);
    fs::remove_dir_all(dir).unwrap();
    fs::remove_dir_all(outside).unwrap();
}

#[test]
fn serves_the_bridge_script() {
    let response = serve(&PluginFrames::default(), "/__sdk/plugin-bridge.js", "GET");
    assert_eq!(response.status(), StatusCode::OK);
    assert!(String::from_utf8_lossy(response.body()).contains("nekopapa:connect"));
}

#[test]
fn splits_paths_into_id_and_safe_segments() {
    assert_eq!(split_path("/a.b/ui/index.html"), Some(("a.b".into(), vec!["ui".into(), "index.html".into()])));
    assert_eq!(split_path("/a.b/my%20file.html"), None);
    assert_eq!(split_path("/A.B/index.html"), None);
    assert_eq!(content_type("x.JS"), Some("text/javascript; charset=utf-8"));
    assert_eq!(content_type("x.wasm"), None);
}
