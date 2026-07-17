<p align="center">
  <img src="assets/cat_moon_icon_no_black_corners.png" alt="NekoPapa app icon" width="160">
</p>

<h1 align="center">NekoPapa</h1>

<p align="center">A Live2D desktop companion that runs inside an app home and a separate native desktop stage.</p>

<p align="center">
  <a href="https://github.com/Hisakazu333/Nekopapa/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Hisakazu333/Nekopapa/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="Apache-2.0 License" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"></a>
  <img alt="Development preview" src="https://img.shields.io/badge/status-development%20preview-f59e0b.svg">
</p>

<p align="center">English · <a href="README.md">简体中文</a></p>

NekoPapa combines a React control surface, Tauri desktop capabilities, and a C++ Live2D Native Stage. The current release focuses on the home, character rendering, and Stage lifecycle. Conversation, memory, world, and Agent screens remain product prototypes and do not indicate complete backing services.

> [!IMPORTANT]
> NekoPapa is a development preview. A successful source build does not verify installers, signing, notarization, Windows runtime behavior, or release quality.

## Project status

This table lists only capabilities confirmed in the current source tree:

| Component | Current state | Boundary |
| --- | --- | --- |
| Desktop window | In development | Tauri 2 + Rust + React + TypeScript with a native title bar |
| Home Live2D | Development model integrated | Pixi.js + Cubism Web inside the WebView |
| Native Stage | v0 development target | C++17 + GLFW + OpenGL + Cubism Native in a separate window |
| Stage lifecycle | Basic control implemented | The Rust host starts, queries, and stops the sidecar |
| NNA / NekoCore-Nano layer | Stub mode | Native Stage does not yet use complete NekoCore-Nano domain state |
| Stage Protocol v1 | Draft | JSON Schema exists; runtime messages remain unversioned v0 |
| Conversation, memory, world, Agent | UI prototypes | No complete service, permission, or persistence flow |
| Legacy Qt | Frozen | Migration evidence only, not a buildable fallback product |

The repository uses the official Momose Hiyori Live2D sample model for development. It is not the final Lumia character asset.

## Quick start

Use browser preview for the React home and Cubism Web. It does not start the Native Stage, so Stage state is simulated.

```bash
git clone https://github.com/Hisakazu333/Nekopapa.git
cd Nekopapa
npm --prefix app/control-desktop ci
npm --prefix app/control-desktop run dev
```

Open `http://127.0.0.1:1420/`.

### Run the desktop app

The desktop app also requires Rust 1.96+, CMake 3.21+, Ninja, a C++17 toolchain, OpenGL, and the [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
npm --prefix app/control-desktop ci
npm --prefix app/control-desktop run tauri -- dev
```

Tauri first builds the Native Stage sidecar for the active Rust target triple. The first configure may download pinned GLFW and nlohmann/json sources from GitHub.

Read the [development environment guide](doc/contributing/development-environment.md) for full setup, standalone Native Stage builds, and troubleshooting.

## Runtime architecture

NekoPapa uses two independent Live2D rendering surfaces:

```text
React UI ── typed bridge ──> Tauri / Rust host ── lifecycle ──> Native Stage
    │                                                            │
    └── Cubism Web / Pixi.js                                     └── Cubism Native / OpenGL
```

- **WebView character**: participates in page layout, clipping, and input
- **Native Stage character**: runs in a separate desktop window
- **Tauri host**: owns windows, capabilities, resource paths, and sidecar lifecycle
- **NNA / NekoCore-Nano layer**: is intended to own persistent companion state; the current build remains in Stub mode

Read the [desktop runtime boundaries](doc/architecture/desktop-runtime-boundaries.md) for state ownership, protocol, and security constraints.

## Naming

NekoPapa is the only current product, desktop package, and repository name. Nekonano-Aether (NNA) and NekoCore-Nano refer to the same underlying system: NNA supplies engineering prefixes such as the C++ `nna` namespace, `NNA_` build options, and `feat/nna-*` branches; NekoCore-Nano is the core name. This public repository builds a Stub by default and does not contain the complete Core implementation.

The `openneko` CMake targets, binaries, and namespace found in source are legacy technical identifiers awaiting migration. They appear only in commands or migration records and must not be used in new product copy, page titles, or document names.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `app/control-desktop/` | React window, Tauri host, and desktop packaging configuration |
| `app/live2d-stage/` | Independent C++ Native Stage |
| `app/stage-desktop/` | Frozen Legacy Qt evidence directory |
| `engine/` | NNA / NekoCore-Nano C++ stub and Cubism Native adapter |
| `protocol/stage/v1/` | Draft Stage JSONL v1 contract and fixtures |
| `assets/` | Runtime and development assets |
| `img/` | Source product prototypes, excluded from packages |
| `doc/` | Governance, engineering, architecture, and product documentation |

Read [repository structure and layering](doc/architecture/repository-layout.md) for current debt and the incremental target layout.

## Development and governance

Changes use short-lived branches and Pull Requests into `main`; the repository has no long-lived `dev` branch. Use `feat/nna-*`, `fix/nna-*`, `refactor/nna-*`, `docs/nna-*`, or `chore/nna-*` branch names.

- [Contributing](CONTRIBUTING.md)
- [Project governance](GOVERNANCE.md)
- [NNA engineering standards](doc/engineering/standards.md)
- [Issue governance and initial backlog](doc/ISSUES.md)
- [Security policy](SECURITY.md)

## Documentation

- [Documentation index](doc/README.md)
- [Product prototype baseline](doc/product/README.md)
- [Desktop UI architecture and acceptance](doc/product/desktop-ui-architecture.md)
- [Desktop architecture](doc/architecture/README.md)
- [Build and test gates](doc/architecture/build-and-test-gates.md)
- [Stage Protocol v1](protocol/stage/v1/README.md)

## License and third-party assets

Repository-owned code uses the [Apache License 2.0](LICENSE).

The Live2D Cubism SDK, Cubism Core, and Momose Hiyori sample model retain their own license and redistribution terms. Apache-2.0 does not cover them. Complete the third-party inventory and package-content audit before publishing an installer. Read the [Live2D asset notes](assets/live2d/README.md) for current source information.
