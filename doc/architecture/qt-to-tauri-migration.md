# Qt to Tauri Desktop Migration

Status: execution plan. Current migration maturity: v0.

## Current source state

The current source tree is already in transition:

- the Qt desktop target and Qt-linked C++ adapters still exist;
- the Qt entry point still attempts to load `qml/main.qml`;
- the current `main` revision contains no tracked QML files;
- CMake still enables the Qt desktop application by default;
- no repository CI currently proves the desktop targets on macOS and Windows.

Therefore the current Qt source is not a verified rollback build. The last
pre-deletion revision, `fb03c9e`, is a historical reference until a maintainer
creates and verifies a real archive branch or tag.

## Repository-history warning

Do not perform migration Git operations against the configured remote until a
maintainer resolves repository ownership.

At the time of this document:

- `origin` points to `https://github.com/Hisakazu333/Nekopapa.git`;
- local `main` and `origin/main` have no common merge base;
- the displayed ahead/behind counts therefore do not represent a normal fork.

Required human decision:

1. identify the authoritative OpenNeko remote;
2. create an offline backup of the local history;
3. verify the local root and intended remote root before changing tracking;
4. only then create a migration branch and push normally.

Do not pull, rebase, merge, or force-push the unrelated `origin/main`. This
document does not modify remotes or declare which server is authoritative.

## Migration principles

- Add new targets beside the Qt target before deleting or renaming it.
- Keep the C++ engine independent from Qt, Tauri, and the WebView.
- Make the protocol boundary explicit before adding feature traffic.
- Switch defaults only after runtime and packaging evidence exists.
- Separate source build success from real-model runtime confirmation.
- Keep every phase reversible without rewriting shared Git history.

## Phase 0: repository and compliance safety

Exit conditions:

- authoritative remote and branch policy are confirmed;
- the local Qt reference revision is preserved and identifiable;
- the project license and source SPDX policy are consistent;
- Cubism SDK, Core, Framework, model, and redistribution obligations are
  recorded for source and packaged artifacts;
- generated binaries, signing material, Node, Rust, and Tauri outputs are
  excluded from Git while lockfiles and capabilities remain tracked.

No default-entry change is allowed before this phase is complete.

## Phase 1: parallel build targets

Target layout:

```text
app/control-desktop/   Tauri host and web frontend
app/live2d-stage/      independent native Stage
app/stage-desktop/     legacy Qt target during migration
protocol/stage/v1/     versioned process contract
```

Requirements:

- the native Stage can be configured without discovering Qt;
- Qt and Stage use separate build directories;
- Tauri packaging stages a target-triple-specific Stage executable;
- existing Qt build scripts do not delete Stage or Cargo outputs;
- generated sidecar binaries are never committed.

Passing this phase means the targets compile independently. It does not prove
transparent-window behavior, Live2D rendering, or a distributable application.

## Phase 2: lifecycle protocol

Implement the smallest v1 slice:

- handshake and version rejection;
- ready event with reported capabilities;
- show, hide, whole-window passthrough, and shutdown;
- correlated command results;
- one-shot health event;
- stdout protocol isolation and stderr logging;
- parent-exit and malformed-input behavior.

The current unversioned Stage stream is v0. It must not be described as v1 until
the schemas and negative tests pass on both platforms.

## Phase 3: one vertical product slice

The first slice should prove lifecycle ownership rather than broad UI parity:

1. launch the Tauri main window;
2. start and stop the native Stage from an explicit user action;
3. display real Stage state from the Tauri backend, not browser simulation;
4. show a licensed real model in the separate companion window;
5. verify hide/show, passthrough, crash reporting, and graceful application exit.

If the main window needs an animated embedded character, implement it with
Cubism Web as a separate work item. Do not embed the native Stage window in the
WebView.

## Phase 4: application-service migration

Move responsibilities out of Qt adapters behind stable application interfaces:

- settings and secure token storage;
- account and backend requests;
- model metadata and selection;
- engine snapshot polling or subscription;
- workspace and Agent operations;
- desktop lifecycle and startup settings.

UI code calls these interfaces through Tauri commands or events. It must not
copy domain rules from the C++ engine.

## Phase 5: default-entry switch

The Tauri application becomes the documented default only after all mandatory
gates in [Build and test gates](build-and-test-gates.md) pass.

At the switch:

- root build guidance points to Tauri;
- macOS and Windows packaging scripts produce verified installable artifacts;
- the Qt target remains explicitly named as legacy for one rollback window;
- release notes state unsupported or deferred features;
- no documentation describes browser simulation as native Stage state.

## Phase 6: Qt removal

Delete Qt code and dependencies only when:

- every retained desktop workflow has a named Tauri owner;
- no release or recovery process depends on the Qt binary;
- the C++ engine and Stage build without Qt discovery;
- historical design references are marked legacy rather than silently edited;
- at least one packaged release has completed the rollback window.

Qt removal is a separate change from the default-entry switch.

## Rollback strategy

- Before the default switch, rollback means selecting the previous documented
  entry point; it does not require deleting Tauri files.
- After the switch, keep the last verified package and its source revision.
- Protocol changes roll back by selecting the last mutually supported version,
  never by accepting unknown messages.
- A Stage crash must not corrupt engine data or prevent the Tauri control window
  from opening.
- Git rollback must use normal commits or a verified branch, not history rewrite.

## Documentation changes required at the switch

- update both README files and developer setup instructions;
- mark Qt/QML architecture documents as historical;
- publish Stage protocol and troubleshooting guidance;
- document which Live2D renderer each window uses;
- document signing, notarization, Windows signing, and third-party notices;
- record the exact verification level for macOS and Windows.

