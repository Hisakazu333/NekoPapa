//! Validate the authorized archive and renew a URL only on an explicit OSS expiry.
use crate::cabin_archive::MAX_DOWNLOAD;
use reqwest::{StatusCode, Url};
use sha2::{Digest, Sha256};
use std::{future::Future, time::Duration};

const MAX_OSS_ERROR_BYTES: usize = 8 * 1024;
const EXPIRED_OSS_ERROR_CODE: &str = "0002-00000069";

pub(super) struct Package {
    url: Url,
    package_id: Option<String>,
    object_key: Option<String>,
    size: u64,
    pub(super) digest: String,
    pub(super) entries: Vec<String>,
}

enum DownloadError {
    Expired,
    Failed(&'static str),
}

impl DownloadError {
    fn message(self) -> String {
        match self {
            Self::Expired => "OSS 下载地址已过期，请重新打开小屋。",
            Self::Failed(message) => message,
        }
        .into()
    }
}

impl Package {
    pub(super) fn new(
        url: &str,
        package_id: Option<&str>,
        object_key: Option<&str>,
        size: u64,
        digest: &str,
        entries: Vec<String>,
    ) -> Result<Self, String> {
        let url = Url::parse(url).map_err(|_| "模型下载地址无效。")?;
        let digest = digest.strip_prefix("sha256:").unwrap_or(digest);
        if url.scheme() != "https"
            || url.domain().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.fragment().is_some()
            || size == 0
            || size > MAX_DOWNLOAD
            || digest.len() != 64
            || !digest.bytes().all(|b| b.is_ascii_hexdigit())
            || entries.is_empty()
            || !entries.iter().all(|entry| entry.ends_with(".model3.json"))
        {
            return Err("模型签名下载清单无效。".into());
        }
        Ok(Self {
            url,
            package_id: package_id.map(str::to_owned),
            object_key: object_key.map(str::to_owned),
            size,
            digest: digest.to_ascii_lowercase(),
            entries,
        })
    }

    pub(super) async fn download_with_refresh(
        &self,
        refresh: impl Future<Output = Result<Self, String>>,
    ) -> Result<Vec<u8>, String> {
        // The signed object URL receives no account credentials or app API headers.
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(120))
            .build()
            .map_err(|_| "无法准备 OSS 下载。")?;
        match self.download(&client).await {
            Ok(bytes) => Ok(bytes),
            Err(DownloadError::Expired) => {
                let updated = refresh.await?;
                if !self.matches_for_refresh(&updated) {
                    return Err("模型发布包已更新，请重新打开小屋。".into());
                }
                updated
                    .download(&client)
                    .await
                    .map_err(DownloadError::message)
            }
            Err(error) => Err(error.message()),
        }
    }

    fn matches_for_refresh(&self, updated: &Self) -> bool {
        // Older descriptors can still download once. Renewal needs proof of the same package and object.
        self.package_id.is_some()
            && self.object_key.is_some()
            && self.package_id == updated.package_id
            && self.object_key == updated.object_key
            && self.size == updated.size
            && self.digest == updated.digest
            && self.entries == updated.entries
    }

    async fn download(&self, client: &reqwest::Client) -> Result<Vec<u8>, DownloadError> {
        let mut response = client
            .get(self.url.clone())
            .send()
            .await
            .map_err(|_| DownloadError::Failed("未能连接 OSS，请重试。"))?;
        if response.status() == StatusCode::FORBIDDEN && is_expired_url(&mut response).await {
            return Err(DownloadError::Expired);
        }
        if !response.status().is_success()
            || response.content_length().is_some_and(|n| n != self.size)
        {
            return Err(DownloadError::Failed("OSS 拒绝下载或包体大小不符。"));
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| DownloadError::Failed("模型下载中断。"))?
        {
            if (bytes.len() + chunk.len()) as u64 > self.size {
                return Err(DownloadError::Failed("模型超过清单大小。"));
            }
            bytes.extend_from_slice(&chunk);
        }
        if bytes.len() as u64 != self.size || format!("{:x}", Sha256::digest(&bytes)) != self.digest
        {
            return Err(DownloadError::Failed("模型包未通过大小或 SHA-256 校验。"));
        }
        Ok(bytes)
    }
}

async fn is_expired_url(response: &mut reqwest::Response) -> bool {
    let mut error_body = Vec::new();
    loop {
        match response.chunk().await {
            Ok(Some(chunk)) if error_body.len() + chunk.len() <= MAX_OSS_ERROR_BYTES => {
                error_body.extend_from_slice(&chunk);
            }
            Ok(None) => break,
            _ => return false,
        }
    }
    let Ok(error) = std::str::from_utf8(&error_body) else {
        return false;
    };
    // Current OSS replies include an extended code. Older V1 replies use AccessDenied and this message.
    xml_value(error, "EC") == Some(EXPIRED_OSS_ERROR_CODE)
        || (xml_value(error, "Code") == Some("AccessDenied")
            && xml_value(error, "Message")
                .is_some_and(|message| message.trim_end_matches('.') == "Request has expired"))
}

fn xml_value<'a>(body: &'a str, tag: &str) -> Option<&'a str> {
    let (_, value_and_end) = body.split_once(&format!("<{tag}>"))?;
    let (value, _) = value_and_end.split_once(&format!("</{tag}>"))?;
    Some(value.trim())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{BufRead, BufReader, Write},
        net::TcpListener,
        thread,
        time::Instant,
    };

    const ARCHIVE: &[u8] = b"fixture archive";
    const EXPIRED: &str =
        "<Error><Code>AccessDenied</Code><Message>Request has expired.</Message></Error>";

    fn package_for_test(url: &str) -> Package {
        let mut package = Package::new(
            "https://objects.example/model",
            Some("OFFICIAL:cat_006:sample"),
            Some("fixtures/archive.zip"),
            ARCHIVE.len() as u64,
            &format!("{:x}", Sha256::digest(ARCHIVE)),
            vec!["package/scene.model3.json".into()],
        )
        .unwrap();
        // Only the transport fixture bypasses the HTTPS descriptor requirement.
        package.url = Url::parse(url).unwrap();
        package
    }

    fn fixture(
        replies: Vec<(&'static str, &'static str, &'static [u8])>,
    ) -> (String, thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let server = thread::spawn(move || {
            for (path, status, body) in replies {
                let start = Instant::now();
                let mut stream = loop {
                    match listener.accept() {
                        Ok((stream, _)) => break stream,
                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                            assert!(start.elapsed() < Duration::from_secs(3), "missing {path}");
                            thread::sleep(Duration::from_millis(5));
                        }
                        Err(error) => panic!("{error}"),
                    }
                };
                stream
                    .set_read_timeout(Some(Duration::from_secs(3)))
                    .unwrap();
                let mut reader = BufReader::new(&mut stream);
                let mut line = String::new();
                reader.read_line(&mut line).unwrap();
                assert_eq!(line.trim(), format!("GET {path} HTTP/1.1"));
                loop {
                    line.clear();
                    reader.read_line(&mut line).unwrap();
                    let header = line.to_ascii_lowercase();
                    assert!(!header.starts_with("authorization:"));
                    if line.trim().is_empty() {
                        break;
                    }
                }
                write!(
                    stream,
                    "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                )
                .unwrap();
                stream.write_all(body).unwrap();
            }
        });
        (base, server)
    }

    #[test]
    fn accepts_only_https_and_verifiable_descriptors() {
        let digest = "a".repeat(64);
        for (url, digest, expected) in [
            ("https://objects.example/model", digest.as_str(), true),
            ("http://objects.example/model", digest.as_str(), false),
            ("https://objects.example/model", "invalid", false),
        ] {
            assert_eq!(
                Package::new(
                    url,
                    None,
                    None,
                    22,
                    digest,
                    vec!["model.model3.json".into()]
                )
                .is_ok(),
                expected
            );
        }
    }

    #[test]
    fn renews_the_same_archive_after_explicit_expiry() {
        let (base, server) = fixture(vec![
            ("/expired", "403 Forbidden", EXPIRED.as_bytes()),
            ("/fresh", "200 OK", ARCHIVE),
        ]);
        let original = package_for_test(&format!("{base}/expired"));
        let refreshed = package_for_test(&format!("{base}/fresh"));
        let bytes =
            tauri::async_runtime::block_on(original.download_with_refresh(async { Ok(refreshed) }))
                .unwrap();
        assert_eq!(bytes, ARCHIVE);
        server.join().unwrap();
    }

    #[test]
    fn refuses_to_retry_a_distinct_package_or_an_ordinary_denial() {
        let (base, server) = fixture(vec![
            ("/expired", "403 Forbidden", EXPIRED.as_bytes()),
            (
                "/forbidden",
                "403 Forbidden",
                b"<Error><Code>AccessDenied</Code></Error>",
            ),
        ]);
        let original = package_for_test(&format!("{base}/expired"));
        let mut changed = package_for_test(&format!("{base}/unexpected"));
        changed.object_key = Some("fixtures/new-archive.zip".into());
        let error =
            tauri::async_runtime::block_on(original.download_with_refresh(async { Ok(changed) }))
                .unwrap_err();
        assert!(error.contains("模型发布包已更新"));

        let denied = package_for_test(&format!("{base}/forbidden"));
        let error = tauri::async_runtime::block_on(denied.download_with_refresh(async {
            panic!("ordinary storage denial must not call the signer");
        }))
        .unwrap_err();
        assert!(error.contains("OSS 拒绝下载"));
        server.join().unwrap();
    }
}
