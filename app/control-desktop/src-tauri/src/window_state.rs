use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Monitor, Runtime, WebviewWindow};

const MAIN_WINDOW_LABEL: &str = "main";
const STATE_FILE_NAME: &str = "window-state.json";
const MIN_WIDTH: f64 = 1024.0;
const MIN_HEIGHT: f64 = 720.0;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
struct WindowState {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    maximized: bool,
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct LogicalRect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl WindowState {
    fn validated(mut self) -> Option<Self> {
        let values = [self.x, self.y, self.width, self.height];
        if !values.into_iter().all(f64::is_finite) || self.width <= 0.0 || self.height <= 0.0 {
            return None;
        }

        self.width = self.width.max(MIN_WIDTH);
        self.height = self.height.max(MIN_HEIGHT);
        Some(self)
    }

    fn rect(self) -> LogicalRect {
        LogicalRect {
            x: self.x,
            y: self.y,
            width: self.width,
            height: self.height,
        }
    }
}

impl LogicalRect {
    fn from_physical(x: i32, y: i32, width: u32, height: u32, scale_factor: f64) -> Option<Self> {
        if !scale_factor.is_finite() || scale_factor <= 0.0 {
            return None;
        }

        Some(Self {
            x: f64::from(x) / scale_factor,
            y: f64::from(y) / scale_factor,
            width: f64::from(width) / scale_factor,
            height: f64::from(height) / scale_factor,
        })
    }

    fn intersects(self, other: Self) -> bool {
        self.width > 0.0
            && self.height > 0.0
            && other.width > 0.0
            && other.height > 0.0
            && self.x < other.x + other.width
            && self.x + self.width > other.x
            && self.y < other.y + other.height
            && self.y + self.height > other.y
    }
}

pub(crate) fn restore_main_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        report("restore", "main window is not available");
        return;
    };

    let path = match state_path(app) {
        Ok(path) => path,
        Err(error) => {
            report("resolve state path", error);
            return;
        }
    };

    let state = match read_state(&path) {
        Ok(Some(state)) => state,
        Ok(None) => return,
        Err(error) => {
            report("read saved state", error);
            return;
        }
    };

    if let Err(error) = window.set_size(LogicalSize::new(state.width, state.height)) {
        report("restore size", error);
    }

    match window.available_monitors() {
        Ok(monitors) if intersects_available_work_area(state, &monitors) => {
            if let Err(error) = window.set_position(LogicalPosition::new(state.x, state.y)) {
                report("restore position", error);
            }
        }
        Ok(_) => report(
            "restore position",
            "saved position is outside every monitor work area",
        ),
        Err(error) => report("inspect monitor work areas", error),
    }

    let maximized_result = if state.maximized {
        window.maximize()
    } else {
        window.unmaximize()
    };
    if let Err(error) = maximized_result {
        report("restore maximized state", error);
    }
}

pub(crate) fn save_main_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        report("save", "main window is not available");
        return;
    };

    let state = match snapshot(&window) {
        Ok(state) => state,
        Err(error) => {
            report("capture current state", error);
            return;
        }
    };
    let path = match state_path(app) {
        Ok(path) => path,
        Err(error) => {
            report("resolve state path", error);
            return;
        }
    };
    let bytes = match serde_json::to_vec_pretty(&state) {
        Ok(mut bytes) => {
            bytes.push(b'\n');
            bytes
        }
        Err(error) => {
            report("serialize current state", error);
            return;
        }
    };

    if let Err(error) = atomic_write(&path, &bytes) {
        report("write saved state", error);
    }
}

fn state_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(STATE_FILE_NAME))
        .map_err(|error| error.to_string())
}

fn read_state(path: &Path) -> Result<Option<WindowState>, String> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };

    let state: WindowState = serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
    state
        .validated()
        .map(Some)
        .ok_or_else(|| "saved state contains invalid coordinates or dimensions".to_owned())
}

fn snapshot<R: Runtime>(window: &WebviewWindow<R>) -> Result<WindowState, String> {
    let scale_factor = window
        .scale_factor()
        .map_err(|error| format!("read scale factor: {error}"))?;
    if !scale_factor.is_finite() || scale_factor <= 0.0 {
        return Err(format!("invalid scale factor: {scale_factor}"));
    }

    let position = window
        .outer_position()
        .map_err(|error| format!("read outer position: {error}"))?;
    let size = window
        .inner_size()
        .map_err(|error| format!("read inner size: {error}"))?;
    let maximized = window
        .is_maximized()
        .map_err(|error| format!("read maximized state: {error}"))?;

    WindowState {
        x: f64::from(position.x) / scale_factor,
        y: f64::from(position.y) / scale_factor,
        width: f64::from(size.width) / scale_factor,
        height: f64::from(size.height) / scale_factor,
        maximized,
    }
    .validated()
    .ok_or_else(|| "window returned invalid coordinates or dimensions".to_owned())
}

fn intersects_available_work_area(state: WindowState, monitors: &[Monitor]) -> bool {
    monitors.iter().any(|monitor| {
        let work_area = monitor.work_area();
        LogicalRect::from_physical(
            work_area.position.x,
            work_area.position.y,
            work_area.size.width,
            work_area.size.height,
            monitor.scale_factor(),
        )
        .is_some_and(|work_area| state.rect().intersects(work_area))
    })
}

fn atomic_write(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = path.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "window state path has no parent directory",
        )
    })?;
    fs::create_dir_all(parent)?;

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temporary_path = parent.join(format!(
        ".{STATE_FILE_NAME}-{}-{nonce}.tmp",
        std::process::id()
    ));

    let result = (|| {
        let mut temporary_file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary_path)?;
        temporary_file.write_all(bytes)?;
        temporary_file.sync_all()?;
        drop(temporary_file);

        replace_file(&temporary_path, path)?;
        sync_directory(parent);
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temporary_path);
    }
    result
}

#[cfg(not(windows))]
fn replace_file(source: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(source, destination)
}

#[cfg(windows)]
fn replace_file(source: &Path, destination: &Path) -> io::Result<()> {
    if destination.exists() {
        fs::remove_file(destination)?;
    }
    fs::rename(source, destination)
}

fn sync_directory(path: &Path) {
    if let Ok(directory) = File::open(path) {
        let _ = directory.sync_all();
    }
}

fn report(context: &str, error: impl std::fmt::Display) {
    eprintln!("[window-state] {context}: {error}");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state(x: f64, y: f64, width: f64, height: f64) -> WindowState {
        WindowState {
            x,
            y,
            width,
            height,
            maximized: false,
        }
    }

    #[test]
    fn validation_enforces_minimum_dimensions() {
        let validated = state(20.0, 30.0, 640.0, 480.0).validated();

        assert_eq!(validated, Some(state(20.0, 30.0, MIN_WIDTH, MIN_HEIGHT)));
    }

    #[test]
    fn validation_rejects_non_finite_or_non_positive_values() {
        assert!(state(f64::NAN, 0.0, 1200.0, 800.0).validated().is_none());
        assert!(state(0.0, 0.0, 0.0, 800.0).validated().is_none());
        assert!(state(0.0, 0.0, 1200.0, -1.0).validated().is_none());
    }

    #[test]
    fn physical_work_area_is_converted_using_monitor_scale() {
        let work_area = LogicalRect::from_physical(200, 100, 2400, 1600, 2.0);

        assert_eq!(
            work_area,
            Some(LogicalRect {
                x: 100.0,
                y: 50.0,
                width: 1200.0,
                height: 800.0,
            })
        );
    }

    #[test]
    fn rectangles_must_overlap_with_positive_area() {
        let work_area = LogicalRect {
            x: 0.0,
            y: 0.0,
            width: 1920.0,
            height: 1080.0,
        };

        assert!(
            state(-100.0, 100.0, 1024.0, 720.0)
                .rect()
                .intersects(work_area)
        );
        assert!(
            !state(1920.0, 100.0, 1024.0, 720.0)
                .rect()
                .intersects(work_area)
        );
        assert!(
            !state(100.0, 1080.0, 1024.0, 720.0)
                .rect()
                .intersects(work_area)
        );
    }
}
