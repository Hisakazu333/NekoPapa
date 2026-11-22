//! Main-window bridge to the signed-in user's verified Nano renderer.
use serde::Deserialize;
use serde_json::Value;
use tauri::{Runtime, Webview};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Layout {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    visible: bool,
    #[serde(default)]
    exclusions: Vec<[f64; 4]>,
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Action {
    Mount {
        mount: String,
        layout: Layout,
        reduced: bool,
    },
    Layout {
        layout: Layout,
        reduced: bool,
    },
    Ready,
    Motion {
        group: String,
    },
    Tap {
        x: f32,
        y: f32,
    },
    Gaze {
        target: Option<[f32; 2]>,
    },
    Framing {
        close: bool,
    },
    Unmount,
}

#[tauri::command]
pub async fn cabin_native<R: Runtime>(
    webview: Webview<R>,
    owner: String,
    action: Action,
) -> Result<Value, String> {
    if webview.label() != "main" || webview.window().label() != "main" {
        return Err("小屋只在主窗口可用。".into());
    }
    if owner.len() != 32 || !owner.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("小屋舞台已失效。".into());
    }
    #[cfg(target_os = "macos")]
    {
        mac::run(webview, owner, action).await
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = action;
        Err("此平台没有原生小屋渲染器。".into())
    }
}

#[cfg(target_os = "macos")]
pub mod mac {
    use super::{Action, Layout};
    use crate::account_auth::{cabin::verified_model, AccountAuth};
    use crate::cabin_files::CabinFiles;
    use serde_json::{json, Value};
    use std::ffi::{c_char, c_void, CString};
    use std::sync::{Arc, Mutex};
    use tauri::{Manager, Runtime, Webview};

    extern "C" {
        fn neko_cabin_create(
            view: *mut c_void,
            root: *const c_char,
            model: *const c_char,
            x: f64,
            y: f64,
            width: f64,
            height: f64,
            reduced: i32,
            visible: i32,
        ) -> *mut c_void;
        fn neko_cabin_layout(
            handle: *mut c_void,
            x: f64,
            y: f64,
            width: f64,
            height: f64,
            visible: i32,
        );
        fn neko_cabin_apply_exclusions(handle: *mut c_void, rects: *const f64, count: usize);
        fn neko_cabin_destroy(handle: *mut c_void);
        fn neko_cabin_tap(handle: *mut c_void, x: f32, y: f32) -> i32;
        fn nna_mac_model_ready() -> i32;
        fn nna_mac_configure(reduced: i32);
        fn nna_mac_start_motion(group: *const c_char) -> i32;
        fn nna_live2d_set_performance_gaze_target(x: f32, y: f32, strength: f32, hold_ms: u64);
        fn nna_live2d_release_performance_gaze(release_ms: u64);
        fn nna_live2d_set_view_offset(x: f32, y: f32, scale: f32);
    }

    #[derive(Default)]
    pub struct CabinView(Mutex<Option<Active>>);

    struct Active {
        owner: String,
        object: usize,
        files: Arc<CabinFiles>,
        reduced: bool,
    }

    impl Drop for Active {
        fn drop(&mut self) {
            // Active is only removed from the state by the AppKit-thread callback.
            unsafe { neko_cabin_destroy(self.object as *mut c_void) };
        }
    }

    impl Layout {
        fn valid(&self) -> bool {
            [self.x, self.y, self.width, self.height]
                .into_iter()
                .all(|value| value.is_finite() && value.abs() < 32_768.0)
                && self.width > 0.0
                && self.height > 0.0
                && self.exclusions.len() <= 8
                && self
                    .exclusions
                    .iter()
                    .flatten()
                    .all(|value| value.is_finite() && value.abs() < 32_768.0)
        }
    }

    fn apply(
        active: &mut Option<Active>,
        auth: &AccountAuth,
        view: *mut c_void,
        owner: String,
        action: Action,
    ) -> Result<Value, String> {
        if let Action::Mount {
            mount,
            layout,
            reduced,
        } = action
        {
            if !layout.valid() {
                return Err("小屋舞台尺寸无效。".into());
            }
            let files = verified_model(auth, &mount)?;
            let (root, model) = files.native_entry()?;
            let groups = files.motion_groups()?;
            let root =
                CString::new(root.as_os_str().as_encoded_bytes()).map_err(|_| "模型目录无效。")?;
            let model = CString::new(model).map_err(|_| "模型入口无效。")?;
            *active = None;
            let handle = unsafe {
                neko_cabin_create(
                    view,
                    root.as_ptr(),
                    model.as_ptr(),
                    layout.x,
                    layout.y,
                    layout.width,
                    layout.height,
                    i32::from(reduced),
                    i32::from(layout.visible),
                )
            };
            if handle.is_null() {
                return Err("无法打开 macOS 原生模型视图。".into());
            }
            unsafe { apply_exclusions(handle, &layout) };
            *active = Some(Active {
                owner,
                object: handle as usize,
                files,
                reduced,
            });
            return Ok(json!(groups));
        }

        let Some(stage) = active.as_mut().filter(|stage| stage.owner == owner) else {
            return Ok(Value::Null);
        };
        if matches!(action, Action::Unmount) {
            *active = None;
            return Ok(Value::Null);
        }
        if verified_model(auth, &stage.files.mount).is_err() {
            *active = None;
            return Err("当前账号的模型授权已更新。".into());
        }

        let handle = stage.object as *mut c_void;
        // All FFI operations are serialized on the AppKit thread and target the live view.
        unsafe {
            match action {
                Action::Layout { layout, reduced } if layout.valid() => {
                    if !layout.visible || reduced {
                        nna_live2d_release_performance_gaze(240);
                    }
                    if stage.reduced != reduced {
                        nna_mac_configure(i32::from(reduced));
                        stage.reduced = reduced;
                    }
                    neko_cabin_layout(
                        handle,
                        layout.x,
                        layout.y,
                        layout.width,
                        layout.height,
                        i32::from(layout.visible),
                    );
                    apply_exclusions(handle, &layout);
                }
                Action::Ready => return Ok(json!(nna_mac_model_ready() != 0)),
                Action::Framing { close } => {
                    nna_live2d_set_view_offset(
                        0.0,
                        if close { -0.40 } else { 0.0 },
                        if close { 1.75 } else { 1.0 },
                    );
                }
                Action::Motion { group } if !stage.reduced => {
                    if group.is_empty() || group.len() > 256 {
                        return Ok(json!(false));
                    }
                    let group = CString::new(group).map_err(|_| "模型动作无效。")?;
                    return Ok(json!(nna_mac_start_motion(group.as_ptr()) != 0));
                }
                Action::Tap { x, y }
                    if !stage.reduced && (0.0..=1.0).contains(&x) && (0.0..=1.0).contains(&y) =>
                {
                    return Ok(json!(neko_cabin_tap(handle, x, y) != 0));
                }
                Action::Gaze {
                    target: Some([x, y]),
                } if !stage.reduced && (-1.0..=1.0).contains(&x) && (-1.0..=1.0).contains(&y) => {
                    nna_live2d_set_performance_gaze_target(x, y, 0.9, 500);
                }
                Action::Gaze { target: None } => nna_live2d_release_performance_gaze(240),
                _ => {}
            }
        }
        Ok(Value::Null)
    }

    unsafe fn apply_exclusions(handle: *mut c_void, layout: &Layout) {
        neko_cabin_apply_exclusions(
            handle,
            layout.exclusions.as_ptr().cast(),
            layout.exclusions.len(),
        );
    }

    pub(super) async fn run<R: Runtime>(
        webview: Webview<R>,
        owner: String,
        action: Action,
    ) -> Result<Value, String> {
        let app = webview.app_handle().clone();
        let (send, recv) = tokio::sync::oneshot::channel();
        webview
            .with_webview(move |web| {
                let state = app.state::<CabinView>();
                let auth = app.state::<AccountAuth>();
                let result = state
                    .0
                    .lock()
                    .map_err(|_| "小屋舞台状态无效。".to_owned())
                    .and_then(|mut stage| apply(&mut stage, &auth, web.inner(), owner, action));
                let _ = send.send(result);
            })
            .map_err(|_| "原生小屋窗口已关闭。")?;
        recv.await.map_err(|_| "原生小屋窗口已关闭。")?
    }
}
