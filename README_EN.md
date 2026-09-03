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
external native repository; their source and Cubism Native SDK are no longer duplicated here.
The desktop host consumes the native runtime as a prebuilt sidecar.

> [!IMPORTANT]
> NekoPapa is a development preview. This repository does not include a Native Stage binary.
> Browser preview works without it, while Tauri development and packaging fail early with a
> clear error until a compatible sidecar is supplied.

<p align="center">
  <img src="doc/assets/readme/home-browser-preview.png" alt="NekoPapa home browser preview with centered navigation, a Live2D character, status panels, and composer" width="1200">
</p>

## Current status

| Module | Verified state | Boundary |
| --- | --- | --- |
| React main window | In development | Pages, navigation, and preview data in `app/control-desktop/` |
| Embedded Live2D | Development model integrated | Pixi.js + Cubism Web in the WebView or browser |
| Tauri host | Basic lifecycle implemented | Starts, inspects, and stops a fixed Native Stage sidecar |
| Native Stage | External dependency | No implementation or binary in this repository |
| NekoCore | Not connected | Core source is external; related UI data remains placeholder or preview state |
| Stage Protocol v1 | Draft | Schemas and examples are present; the host still retains minimal legacy v0 behavior |
| Conversation, memory, world, Agent | UI prototypes | No complete service, permission, or persistence loop |

CI currently checks repository hygiene, documentation links, frontend typechecking/builds, and
Rust formatting/lint/tests. It does not verify the external Stage source, GPU runtime, or final
installers.

## Quick start

Browser preview requires Node.js 24 and npm:

```bash
npm --prefix app/control-desktop ci
npm --prefix app/control-desktop run dev
```

Open `http://127.0.0.1:1420/`. Browser mode does not launch the sidecar and simulates Stage state.

### Run the Tauri desktop app

You also need Rust 1.96+ and the platform-specific
[Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/). Supply a Native Stage binary
matching the Rust target triple first:

```bash
export NEKOPAPA_NATIVE_STAGE_BINARY=/absolute/path/to/nekopapa-native-stage
npm --prefix app/control-desktop run tauri -- dev
```

Alternatively, follow the [`native-prebuilt/`](native-prebuilt/README.md) directory convention.
The preparation script copies the artifact to Tauri's target-triple sidecar name. An Android or
HarmonyOS `.so` cannot replace a macOS or Windows desktop sidecar.

## Runtime boundary

```text
React UI ── typed bridge ──> Tauri / Rust host ── process + JSONL ──> external Native Stage
    │
    └── Pixi.js / Cubism Web embedded canvas
```

- React owns pages, interaction, and short-lived UI state.
- Tauri owns windows, permissions, resource lookup, and sidecar lifecycle.
- The external Native Stage owns the independent companion window, native rendering, and C++
  platform dependencies.
- `protocol/stage/v1/` defines the target message contract; files alone do not prove runtime
  compatibility.

See [ADR-0001](doc/architecture/adr/0001-external-native-stage.md) and the
[runtime boundary](doc/architecture/desktop-runtime-boundaries.md).

## Repository layout

| Path | Responsibility |
| --- | --- |
| `app/control-desktop/` | React main window and Tauri/Rust desktop host |
| `prototype/desktop-app/` | Zero-build product UI design baseline |
| `protocol/stage/v1/` | Native Stage JSONL v1 draft and fixtures |
| `native-prebuilt/` | Local delivery convention for an external sidecar; binaries are ignored |
| `assets/` | Runtime assets used by the WebView and package |
| `doc/` | Product, architecture, development, and governance documentation |

## Contributing

- [Contributing guide](CONTRIBUTING.md) (Chinese)
- [Development environment](doc/contributing/development-environment.md) (Chinese)
- [Documentation index](doc/README_EN.md)
- [Project governance](GOVERNANCE.md) (Chinese)
- [Security policy](SECURITY.md) (Chinese)

## License and third-party assets

Repository-owned code uses the [Apache License 2.0](LICENSE). The Live2D sample model, Cubism Web
dependencies, and SDK/runtime contained in an external Native Stage have their own terms. The
artifact producer must provide provenance, version, checksum, and license notices. See the
[Live2D asset notes](assets/live2d/README.md).
