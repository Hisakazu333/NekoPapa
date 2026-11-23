use super::super::tests::{fixture_auth, reply, ATTEMPT};
use super::super::{sign_in, SignIn};
use super::*;
use reqwest::Url;
use serde_json::Value;

fn listener() -> (std::net::TcpListener, Url) {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let base = Url::parse(&format!("http://{}", listener.local_addr().unwrap())).unwrap();
    (listener, base)
}

fn login(listener: &std::net::TcpListener, last_login: Value) {
    reply(
        listener,
        "POST /api/app/auth/mobile/login",
        None,
        None,
        json!({"code":200, "data":{"token":"first-token", "userInfo":{"lastLoginTime": last_login}}}),
    );
    reply(
        listener,
        "GET /api/app/user/profile",
        Some("first-token"),
        None,
        json!({"code":200, "data":{"userId":7, "userName":"养猫的人7"}}),
    );
}

fn sms(
    auth: &AccountAuth,
) -> impl std::future::Future<Output = Result<AccountProfile, String>> + '_ {
    sign_in(
        auth,
        ATTEMPT.into(),
        SignIn::Sms {
            mobile: "13812345678".into(),
            code: "123456".into(),
        },
    )
}

#[test]
fn masks_keep_only_the_prefix_and_last_four_digits() {
    assert_eq!(mask("13812345678"), "138****5678");
    assert_eq!(mask("+447700900123"), "+44******0123");
    assert_eq!(mask("12345"), "12345");
}

#[test]
fn only_an_account_created_by_this_sms_sign_in_is_offered_setup() {
    let (listener, base) = listener();
    let fixture = std::thread::spawn(move || {
        login(&listener, json!("2026-11-01 10:00:00"));
        login(&listener, Value::Null);
    });
    tauri::async_runtime::block_on(async move {
        let auth = fixture_auth(base);
        sms(&auth).await.unwrap();
        assert!(!status(&auth).unwrap().pending);
        lock(&auth).unwrap().session = None;
        sms(&auth).await.unwrap();
        let result = status(&auth).unwrap();
        assert!(result.pending);
        assert_eq!(result.masked_mobile.as_deref(), Some("138****5678"));
    });
    fixture.join().unwrap();
}

#[test]
fn setup_saves_the_nickname_and_binds_a_password_with_the_new_token() {
    let (listener, base) = listener();
    let fixture = std::thread::spawn(move || {
        login(&listener, Value::Null);
        reply(
            &listener,
            "POST /api/app/user/nickname",
            Some("first-token"),
            Some(json!({"nickname":"小猫"})),
            json!({"code":200, "data":{"userId":7, "userName":"小猫"}}),
        );
        reply(
            &listener,
            "POST /api/app/user/send-code",
            Some("first-token"),
            Some(json!({"type":"phone", "account":"13812345678"})),
            json!({"code":200}),
        );
        reply(
            &listener,
            "POST /api/app/auth/password/bind",
            Some("first-token"),
            Some(json!({"mobile":"13812345678", "password":"secret-1", "code":"654321"})),
            json!({"code":200, "data":{"token":"bound-token", "passwordConfigured":true}}),
        );
    });
    tauri::async_runtime::block_on(async move {
        let auth = fixture_auth(base);
        sms(&auth).await.unwrap();
        let profile = update_nickname(&auth, "  小猫 ".into()).await.unwrap();
        assert_eq!(profile.user_name.as_deref(), Some("小猫"));
        send_password_code(&auth).await.unwrap();
        assert!(set_password(&auth, "654321".into(), "short".into())
            .await
            .is_err());
        set_password(&auth, "654321".into(), "secret-1".into())
            .await
            .unwrap();
        let state = lock(&auth).unwrap();
        let session = state.session.as_ref().unwrap();
        assert_eq!(session.token, "bound-token");
        assert_eq!(session.profile.user_name.as_deref(), Some("小猫"));
        assert!(session.setup_mobile.is_none());
    });
    fixture.join().unwrap();
}

#[test]
fn setup_rejects_invalid_input_and_rejected_codes_keep_it_open() {
    let (listener, base) = listener();
    let fixture = std::thread::spawn(move || {
        login(&listener, Value::Null);
        reply(
            &listener,
            "POST /api/app/auth/password/bind",
            Some("first-token"),
            None,
            json!({"code":500, "msg":"验证码错误或已过期"}),
        );
    });
    tauri::async_runtime::block_on(async move {
        let auth = fixture_auth(base);
        assert!(
            update_nickname(&auth, "小猫".into()).await.is_err(),
            "signed out"
        );
        sms(&auth).await.unwrap();
        assert!(update_nickname(&auth, "   ".into()).await.is_err());
        assert!(update_nickname(&auth, "a".repeat(33)).await.is_err());
        assert!(set_password(&auth, "12a456".into(), "secret-1".into())
            .await
            .is_err());
        assert!(
            set_password(&auth, "123456".into(), "长".repeat(25))
                .await
                .is_err(),
            "over 72 bytes"
        );
        let error = set_password(&auth, "123456".into(), "secret-1".into())
            .await
            .err()
            .unwrap();
        assert_eq!(error, "验证码错误或已过期");
        assert!(status(&auth).unwrap().pending);
        assert_eq!(
            lock(&auth).unwrap().session.as_ref().unwrap().token,
            "first-token"
        );
    });
    fixture.join().unwrap();
}
