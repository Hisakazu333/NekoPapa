<p align="center">
  <img src="assets/cat_moon_icon_no_black_corners.png" alt="NekoPapa application icon" width="160">
</p>

<h1 align="center">NekoPapa</h1>

<p align="center">A React + Tauri desktop client for companion and learning experiences.</p>

<p align="center">
  <a href="https://github.com/Hisakazu333/NekoPapa/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Hisakazu333/NekoPapa/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="Apache-2.0 License" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"></a>
  <img alt="Development preview" src="https://img.shields.io/badge/status-development%20preview-f59e0b.svg">
</p>

<p align="center">English · <a href="README.md">简体中文</a></p>

This repository owns the product UI, Tauri desktop host, Stage process supervision, and
cross-process protocol. The NekoCore-Nano and Native Stage C++ implementations live in an
external native repository; character (Live2D) rendering is owned entirely by that
repository's C++ code. Their source and Cubism Native SDK are no longer duplicated here.
The desktop host consumes the native runtime as a prebuilt sidecar.

> [!IMPORTANT]
> NekoPapa is in a rewrite transition: the previous desktop implementation has been
> removed, and the new client is being rebuilt with Tauri 2 + React against the design
> system 2.0 in `prototype/desktop-app/` ([ADR-0002](doc/architecture/adr/0002-client-rewrite-external-live2d.md)).
> This repository does not include a Native Stage binary; real desktop runs always
> require an external prebuilt artifact.

<p align="center">
  <img src="doc/assets/readme/home-browser-preview.png" alt="NekoPapa home browser preview with centered navigation, a Live2D character, status panels, and composer" width="1200">
</p>

## Current status

| Module | Verified state | Boundary |
| --- | --- | --- |
| Desktop client | Rewrite in progress | Old implementation removed; rebuilt with Tauri 2 + React against the `prototype/desktop-app/` design system 2.0 |
| Character (Live2D) rendering | External implementation | Owned entirely by NekoCore-Nano C++ code; Web Live2D in prototypes is design preview only |
| Tauri host | To be rebuilt | Target: starts, inspects, and stops a fixed Native Stage sidecar |
| Native Stage | External dependency | No implementation or binary in this repository |
| NekoCore | Not connected | Core source is external; related UI data remains placeholder or preview state |
| Stage Protocol v1 | Draft | Schemas and examples are present; v1 must not be claimed before cross-end compatibility tests pass |
| Conversation, memory, world, Agent | UI prototypes | No complete service, permission, or persistence loop |

CI jobs referencing the old implementation will be rebuilt alongside the new skeleton.
CI does not verify the external Stage source, GPU runtime, or final installers.

## Quick start

The only runnable entry point is the design prototype (zero-build static pages; the
Live2D preview needs HTTP):

```bash
prototype/desktop-app/serve.sh
```

Open `http://127.0.0.1:8123/prototype/desktop-app/`. Prototype pages serve as design
preview and acceptance anchors; their Web Live2D does not represent the product
rendering architecture.

### Tauri desktop app (rewrite in progress)

The new client is rebuilt per [ADR-0002](doc/architecture/adr/0002-client-rewrite-external-live2d.md);
run instructions will be updated once the skeleton lands. Desktop runs always need
Rust 1.96+, the platform-specific [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/),
and a Native Stage binary matching the Rust target triple: set
`NEKOPAPA_NATIVE_STAGE_BINARY`, or follow the [`native-prebuilt/`](native-prebuilt/README.md)
directory convention. An Android or HarmonyOS `.so` cannot replace a macOS or Windows
desktop sidecar.

## Runtime boundary

```text
React UI ── typed bridge ──> Tauri / Rust host ── process + JSONL ──> external Native Stage
                                                                          │
                                                                          └── character render window (NekoCore-Nano C++)
```

- React owns pages, interaction, and short-lived UI state; the main window has no
  character canvas.
- Tauri owns windows, permissions, resource lookup, and sidecar lifecycle.
- The external Native Stage owns the independent companion window, native rendering,
  all Live2D rendering, and C++ platform dependencies.
- `protocol/stage/v1/` defines the target message contract; files alone do not prove runtime
  compatibility.

See [ADR-0001](doc/architecture/adr/0001-external-native-stage.md),
[ADR-0002](doc/architecture/adr/0002-client-rewrite-external-live2d.md), and the
[runtime boundary](doc/architecture/desktop-runtime-boundaries.md).

## Repository layout

| Path | Responsibility |
| --- | --- |
| `prototype/desktop-app/` | Zero-build product UI design baseline (single source of truth for design system 2.0) |
| `protocol/stage/v1/` | Native Stage JSONL v1 draft and fixtures |
| `native-prebuilt/` | Local delivery convention for an external sidecar; binaries are ignored |
| `assets/` | Runtime assets used by prototype design previews |
| `doc/` | Product, architecture, development, and governance documentation |

The desktop client source path will be registered once the new skeleton lands; see
[repository layout](doc/architecture/repository-layout.md).

## Contributing

- [Contributing guide](CONTRIBUTING.md) (Chinese)
- [Development environment](doc/contributing/development-environment.md) (Chinese)
- [Documentation index](doc/README_EN.md)
- [Project governance](GOVERNANCE.md) (Chinese)
- [Security policy](SECURITY.md) (Chinese)

## License and third-party assets

Repository-owned code uses the [Apache License 2.0](LICENSE). The Live2D sample model
and the SDK/runtime contained in an external Native Stage have their own terms. The
artifact producer must provide provenance, version, checksum, and license notices. See the
[Live2D asset notes](assets/live2d/README.md).
