//! Finds local inference servers (Ollama, LM Studio, llama.cpp, vLLM, Jan)
//! for the 模型与 API settings page. The app names the ports and paths
//! (src/app/local-models.ts); this only performs a plain HTTP GET against
//! 127.0.0.1 for each, with short timeouts and a size cap, and hands the raw
//! reply back. Nothing is started, installed or downloaded.

use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

const PATHS: [&str; 2] = ["/api/tags", "/v1/models"];
const MAX_TARGETS: usize = 8;
const MAX_BODY: usize = 512 * 1024;
const CONNECT_TIMEOUT: Duration = Duration::from_millis(400);
const READ_TIMEOUT: Duration = Duration::from_millis(2500);

#[derive(Deserialize)]
pub struct ProbeTarget {
    port: u16,
    path: String,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Probe {
    port: u16,
    path: String,
    reachable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[tauri::command]
pub async fn probe_local_models(targets: Vec<ProbeTarget>) -> Result<Vec<Probe>, String> {
    if targets.len() > MAX_TARGETS || targets.iter().any(|t| t.port == 0 || !PATHS.contains(&t.path.as_str())) {
        return Err("检测目标无效。".into());
    }
    let handles: Vec<_> = targets
        .into_iter()
        .map(|target| std::thread::spawn(move || probe(target.port, &target.path)))
        .collect();
    tauri::async_runtime::spawn_blocking(move || {
        handles.into_iter().map(|handle| handle.join().map_err(|_| "检测失败。".to_string())).collect()
    })
    .await
    .map_err(|_| "检测失败。".to_string())?
}

fn probe(port: u16, path: &str) -> Probe {
    let mut result = Probe { port, path: path.into(), reachable: false, status: None, body: None, error: None };
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let mut stream = match TcpStream::connect_timeout(&address, CONNECT_TIMEOUT) {
        Ok(stream) => stream,
        Err(_) => return result,
    };
    result.reachable = true;
    let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
    let _ = stream.set_write_timeout(Some(READ_TIMEOUT));
    let request = format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAccept: application/json\r\nConnection: close\r\n\r\n");
    if stream.write_all(request.as_bytes()).is_err() {
        result.error = Some("服务没有接受请求。".into());
        return result;
    }
    let mut raw = Vec::new();
    let mut chunk = [0u8; 16 * 1024];
    loop {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(read) => {
                raw.extend_from_slice(&chunk[..read]);
                if raw.len() > MAX_BODY + 16 * 1024 {
                    result.error = Some("模型列表过大。".into());
                    return result;
                }
            }
            Err(_) if !raw.is_empty() => break,
            Err(_) => {
                result.error = Some("服务没有及时响应。".into());
                return result;
            }
        }
    }
    match parse_response(&raw) {
        Some((status, body)) => {
            result.status = Some(status);
            result.body = Some(String::from_utf8_lossy(&body).into_owned());
        }
        None => result.error = Some("服务返回的不是 HTTP 响应。".into()),
    }
    result
}

/// Splits an HTTP/1.x response into its status and body, undoing chunked transfer encoding.
fn parse_response(raw: &[u8]) -> Option<(u16, Vec<u8>)> {
    let end = raw.windows(4).position(|window| window == b"\r\n\r\n")?;
    let head = std::str::from_utf8(&raw[..end]).ok()?;
    let mut lines = head.split("\r\n");
    let status_line = lines.next()?;
    if !status_line.starts_with("HTTP/1.") {
        return None;
    }
    let status = status_line.split_whitespace().nth(1)?.parse().ok()?;
    let chunked = lines.any(|line| {
        let lower = line.to_ascii_lowercase();
        lower.starts_with("transfer-encoding:") && lower.contains("chunked")
    });
    let body = &raw[end + 4..];
    Some((status, if chunked { dechunk(body)? } else { body.to_vec() }))
}

fn dechunk(mut body: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    loop {
        let line_end = body.windows(2).position(|window| window == b"\r\n")?;
        let size_text = std::str::from_utf8(&body[..line_end]).ok()?;
        let size = usize::from_str_radix(size_text.split(';').next()?.trim(), 16).ok()?;
        body = &body[line_end + 2..];
        if size == 0 {
            return Some(out);
        }
        if body.len() < size || out.len() + size > MAX_BODY {
            return None;
        }
        out.extend_from_slice(&body[..size]);
        body = body.get(size + 2..)?;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    #[test]
    fn reads_plain_and_chunked_responses() {
        let plain = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"data\":[]}";
        assert_eq!(parse_response(plain), Some((200, b"{\"data\":[]}".to_vec())));
        let chunked = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\n{\"a\"\r\n3\r\n:1}\r\n0\r\n\r\n";
        assert_eq!(parse_response(chunked), Some((200, b"{\"a\":1}".to_vec())));
        assert_eq!(parse_response(b"SSH-2.0-OpenSSH\r\n\r\n"), None);
        assert_eq!(parse_response(b"HTTP/1.1 404 Not Found\r\n\r\n"), Some((404, Vec::new())));
    }

    #[test]
    fn probes_a_local_server_and_reports_a_closed_port() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0u8; 1024];
            let read = stream.read(&mut request).unwrap();
            assert!(String::from_utf8_lossy(&request[..read]).starts_with("GET /api/tags HTTP/1.1"));
            stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 13\r\n\r\n{\"models\":[]}").unwrap();
        });
        let found = probe(port, "/api/tags");
        server.join().unwrap();
        assert_eq!(found, Probe { port, path: "/api/tags".into(), reachable: true, status: Some(200), body: Some("{\"models\":[]}".into()), error: None });

        let closed = TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        assert!(!probe(closed, "/v1/models").reachable);
    }
}
