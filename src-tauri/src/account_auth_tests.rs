use super::*;

#[test]
fn account_origin_requires_https_except_for_loopback() {
    for allowed in [
        "https://accounts.example.test/api",
        "http://127.0.0.1:8080",
        "http://[::1]:8080",
    ] {
        assert!(account_url(allowed).is_some());
    }
    for denied in [
        "http://accounts.example.test",
        "https://name:secret@example.test",
        "https://example.test?a=1",
        "file:///tmp",
        "http://localhost.example.test",
    ] {
        assert!(account_url(denied).is_none());
    }
}

#[test]
fn profile_serialization_keeps_only_account_display_fields() {
    let profile: AccountProfile = serde_json::from_value(json!({
        "userId": 7, "userName": "Account", "cloudPointBalance": 5,
        "token": "private", "phoneNumber": "private", "email": "private"
    }))
    .unwrap();
    let result = serde_json::to_value(profile).unwrap();
    assert_eq!(result["userId"], 7);
    assert_eq!(result["cloudPointBalance"], 5.0);
    assert!(result.get("token").is_none());
    assert!(result.get("phoneNumber").is_none());
    assert!(result.get("email").is_none());
}

fn reply(
    listener: &std::net::TcpListener,
    method_and_path: &str,
    expected_token: Option<&str>,
    expected_body: Option<Value>,
    result: Value,
) {
    use std::io::{BufRead, BufReader, Read, Write};
    let (mut stream, _) = listener.accept().unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(3)))
        .unwrap();
    let mut reader = BufReader::new(&mut stream);
    let mut line = String::new();
    reader.read_line(&mut line).unwrap();
    assert_eq!(line.trim(), format!("{method_and_path} HTTP/1.1"));
    let mut length = 0;
    let mut bearer = None;
    loop {
        line.clear();
        reader.read_line(&mut line).unwrap();
        if line.trim().is_empty() {
            break;
        }
        let (header, value) = line.split_once(':').unwrap();
        if header.eq_ignore_ascii_case("authorization") {
            bearer = value.trim().strip_prefix("Bearer ").map(str::to_owned);
        }
        if header.eq_ignore_ascii_case("content-length") {
            length = value.trim().parse().unwrap();
        }
    }
    assert_eq!(bearer.as_deref(), expected_token);
    if let Some(body) = expected_body {
        let mut bytes = vec![0; length];
        reader.read_exact(&mut bytes).unwrap();
        assert_eq!(serde_json::from_slice::<Value>(&bytes).unwrap(), body);
    }
    let body = result.to_string();
    write!(stream, "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\nContent-Type: application/json\r\n\r\n{body}", body.len()).unwrap();
}

#[test]
fn sms_sign_in_reads_authorized_profile_and_logout_revokes_the_host_session() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let base = Url::parse(&format!("http://{}", listener.local_addr().unwrap())).unwrap();
    let fixture = std::thread::spawn(move || {
        reply(
            &listener,
            "POST /api/app/auth/mobile/login",
            None,
            Some(json!({"mobile":"13800000000", "code":"123456"})),
            json!({"code":200, "data":{"token":"fixture-token"}}),
        );
        reply(
            &listener,
            "GET /api/app/user/profile",
            Some("fixture-token"),
            None,
            json!({"code":200, "data":{"userId":7, "userName":"fixture-account", "email":"private"}}),
        );
        reply(
            &listener,
            "POST /api/app/auth/logout",
            Some("fixture-token"),
            None,
            json!({"code":200}),
        );
    });
    tauri::async_runtime::block_on(async move {
        let auth = AccountAuth {
            state: Mutex::new(AccountState::default()),
            connection: Some((
                base,
                Client::builder()
                    .no_proxy()
                    .timeout(Duration::from_secs(3))
                    .build()
                    .unwrap(),
            )),
        };
        let profile = sign_in(
            &auth,
            "77777777-7777-4777-8777-777777777777".into(),
            SignIn::Sms {
                mobile: "13800000000".into(),
                code: "123456".into(),
            },
        )
        .await
        .unwrap();
        assert_eq!(profile.user_id, 7);
        assert!(serde_json::to_value(profile)
            .unwrap()
            .get("token")
            .is_none());
        assert!(lock(&auth).unwrap().session.is_some());
        sign_out(&auth).await.unwrap();
        assert!(lock(&auth).unwrap().session.is_none());
    });
    fixture.join().unwrap();
}
