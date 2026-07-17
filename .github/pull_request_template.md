## Summary

Describe the user or engineering outcome. Keep implementation detail secondary.

## Linked issue

Closes #

## Scope

- In scope:
- Non-goals:

## Product and prototype evidence

- Prototype reference under `img/` (required for UI changes):
- Before screenshot or recording:
- After screenshot or recording:
- Window size, display scale, OS, and architecture:

## Architecture and risk

- Affected boundary: React UI / Tauri host / Native Stage / engine / protocol / packaging
- New permissions, protocol messages, persisted data, or process-lifecycle behavior:
- Security, privacy, third-party asset, and licensing impact:
- Compatibility and rollback plan:

## Verification

Record only checks actually run. A build does not prove runtime or package behavior.

| Check | Platform | Result |
| --- | --- | --- |
| `npm --prefix app/control-desktop ci` | | |
| `npm --prefix app/control-desktop run check` | | |
| `npm --prefix app/control-desktop run build` | | |
| `cargo fmt --manifest-path app/control-desktop/src-tauri/Cargo.toml -- --check` | | |
| `cargo clippy --manifest-path app/control-desktop/src-tauri/Cargo.toml --all-targets -- -D warnings` | | |
| `cargo test --manifest-path app/control-desktop/src-tauri/Cargo.toml` | | |
| Native Stage CMake build | | |
| Runtime or package verification | | |

## Review checklist

- [ ] The change is bounded to the linked issue and preserves stated non-goals.
- [ ] UI behavior is compared with the exact product prototype where applicable.
- [ ] Frontend, Tauri, Native Stage, engine, and protocol ownership boundaries remain explicit.
- [ ] New behavior has focused automated coverage, or the missing coverage is explained.
- [ ] Generated files, build outputs, credentials, and private paths are not committed.
- [ ] Documentation and compatibility notes are updated when contracts or workflows change.
- [ ] Third-party code and assets have compatible licenses and required notices.
