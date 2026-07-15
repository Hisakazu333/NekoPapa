# Desktop Build and Test Gates

Status: acceptance criteria. Current automated evidence: v0 / absent.

These gates prevent source scaffolding, a green compiler run, and a real
packaged desktop application from being reported as the same thing.

## Verification levels

| Level | Meaning |
| --- | --- |
| Source-reviewed | ownership and configuration were inspected only |
| Schema-validated | JSON examples and negative cases pass the declared schema |
| Build-verified | the target compiles from a clean checkout on the named OS |
| Runtime-smoke-tested | a launched process demonstrates the named behavior |
| Package-verified | an installed signed artifact works on a clean machine |
| Release-verified | required CI, runtime, packaging, licensing, and rollback gates pass |

Every report must name its highest completed level and platform. A result from
macOS does not confirm Windows behavior, and `allow-no-model` does not confirm a
real Live2D model.

## Gate 0: repository safety

Mandatory before migration work is pushed:

- authoritative remote has a verified common history with the migration branch;
- unrelated `Nekopapa.git` history is not merged or force-pushed;
- local work has an offline backup;
- branch protection or an equivalent review rule exists;
- generated artifacts and signing secrets are ignored;
- lockfiles and build manifests are tracked.

Current status: blocked by the remote-history mismatch described in the
migration plan.

## Gate 1: protocol

Mandatory before Tauri controls a release Stage:

- every JSON schema parses as JSON Schema 2020-12;
- every checked-in JSONL example validates line by line;
- malformed JSON does not crash either process;
- unsupported versions are rejected before lifecycle commands run;
- duplicate or missing message IDs are handled deterministically;
- command results use the correct `reply_to` value;
- stdout contains protocol JSONL only and logs use stderr;
- show, hide, passthrough, and shutdown have success and failure tests;
- EOF, parent exit, and child exit have explicit tests.

Current status: v1 schemas are a draft; no end-to-end v1 implementation is
claimed.

## Gate 2: native Stage build

Required matrix:

| Platform | Required build | Required runtime evidence |
| --- | --- | --- |
| macOS Apple Silicon | clean Release build | real process launch and health event |
| Windows x64 | clean Release build | real process launch and health event |

For each platform, record:

- compiler, SDK, CMake, GLFW, and Cubism versions;
- whether the test used a real licensed model or `allow-no-model`;
- architecture of the Stage and every linked runtime library;
- first OpenGL error, renderer information, and process exit code;
- bundle inputs, without secrets or private model paths.

A health check without a model proves only window and renderer initialization.
It must not be reported as model-load or animation success.

## Gate 3: native Stage runtime

Manual or automated runtime checks are required on both operating systems:

- transparent background has no opaque flash during startup;
- always-on-top behavior matches the product setting;
- passthrough can be enabled and disabled without losing control permanently;
- show, hide, close, and parent shutdown leave no orphan process;
- model alpha edges, scale, and crop remain correct after resize;
- mixed-DPI and multiple-monitor movement do not offset the window or pointer;
- sleep/wake, lock/unlock, and display reconnect recover or fail visibly;
- Stage crash is reported in Tauri and restart is bounded;
- hidden or minimized state does not keep an unnecessary full-rate frame loop.

Performance budgets must be written and approved before release. Until then,
measurements may be collected but no claim such as "low CPU" or "60 FPS" is an
acceptance result.

## Gate 4: Tauri control application

Required checks:

- frontend dependency install, lint, type check, unit tests, and production build;
- Rust formatting, lint, unit tests, and release build;
- Tauri capability scope permits only the packaged Stage and required args;
- browser preview and native runtime states are visibly distinguished;
- start/stop controls reflect backend state rather than optimistic simulation;
- malformed Stage output cannot inject UI markup or expose secrets;
- main-window open and navigation still work when Stage is missing or crashed;
- application exit performs bounded Stage shutdown and forced cleanup if needed.

## Gate 5: main-window Cubism Web, when enabled

Cubism Web is optional for the first control-console slice. If enabled, require:

- the model canvas participates in normal DOM clipping and z-order;
- resize and device-pixel-ratio changes do not stretch or blank the model;
- UI overlays remain interactive without forwarding unintended input;
- hidden routes suspend their rendering loop;
- Web and Native adapters agree on supported assets, motion names, expression
  names, parameter ranges, and hit-area identifiers;
- simultaneous main and companion views do not present contradictory state.

This gate does not permit embedding the native Stage window into the WebView.

## Gate 6: packaged artifacts

macOS release evidence:

- Stage and nested libraries are signed with the application;
- hardened runtime and entitlements are reviewed;
- notarization and stapling succeed;
- install, first launch, update, and uninstall are tested on a clean account.

Windows release evidence:

- executable and installer signatures verify;
- Stage and required DLLs are present for the target architecture;
- install, first launch, update, and uninstall are tested on a clean machine;
- WebView2 prerequisite or bundled-runtime behavior is documented.

Both platforms must verify that packages exclude development SDK samples,
unneeded architectures, private source assets, credentials, and debug symbols.
Required licenses and third-party notices must be present.

## CI minimum

Before the Tauri entry becomes default, CI must contain independent jobs for:

1. protocol schema and JSONL tests;
2. frontend lint, type check, unit test, and build;
3. Rust format, lint, test, and build;
4. C++ engine and Stage builds on macOS and Windows;
5. sidecar integration tests with malformed input and child failure;
6. unsigned package smoke builds on pull requests.

Signing and notarization run only in protected release jobs with scoped secrets.
The workflow must preserve logs and checksums as evidence, not merely report a
single aggregate success state.

## Promotion rules

- Development default may switch after Gates 0 through 4 pass on macOS and
  Windows, with deferred Cubism Web work explicitly documented.
- A public release requires every applicable gate, including packaging and
  third-party licensing.
- Qt removal requires a verified Tauri release and a completed rollback window.
- Any failed mandatory gate blocks promotion; it does not become a known issue
  hidden behind a successful build.

