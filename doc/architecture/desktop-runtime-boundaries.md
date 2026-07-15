# Desktop Runtime Boundaries

Status: target architecture. Current implementation maturity: v0.

## Decision

The desktop product is split into four ownership zones:

1. The Tauri host owns the main application lifecycle, permissions, and the
   native Stage child process.
2. The web frontend owns main-window layout and interaction. If the main window
   needs an animated embedded character, it uses Cubism Web in the WebView.
3. The native C++ Stage owns the separate transparent desktop-companion window
   and Cubism Native rendering inside that window.
4. The C++ engine remains the authority for companion state and behavior. UI
   and rendering adapters must not create competing domain state.

This is a target boundary. It does not assert that Cubism Web, the Tauri
sidecar bridge, or synchronized dual rendering is already implemented.

## Runtime map

```text
OpenNeko C++ engine
  | state snapshots and high-level intents
  v
Tauri Rust host
  |                         |
  | frontend events         | versioned JSONL lifecycle control
  v                         v
Main WebView              Native Stage child process
React UI                  transparent top-level window
Cubism Web, when needed   Cubism Native renderer
```

The Stage protocol currently defines lifecycle and whole-window passthrough
only. Model hot loading, per-frame animation values, hit areas, and audio are
not part of protocol v1.

## Responsibility matrix

| Component | Owns | Must not own |
| --- | --- | --- |
| Tauri Rust host | application lifecycle, Stage spawn/stop, capability policy, OS integration, protocol supervision | Live2D frame rendering, companion domain rules |
| React frontend | navigation, forms, main-window layout, user intent, embedded Cubism Web presentation | direct filesystem access, secrets, native Stage process handles |
| Cubism Web adapter | main-window model loading, canvas sizing, web hit testing, rendering-local interpolation | account state, memory, Agent execution, native window behavior |
| Native Stage | transparent companion window, always-on-top behavior, passthrough, Cubism Native frame loop | main-window UI, backend calls, account state, arbitrary shell execution |
| C++ engine | authoritative companion state, behavior decisions, stable snapshots and high-level intents | Tauri, DOM, WebView, or platform-window layout |

## Main-window composition rule

The native Stage is a separate top-level window. It must not be positioned over
the Tauri WebView to imitate an embedded canvas.

Native child windows and WebViews have different compositor and input layers.
Using a native Stage as a main-window surface causes platform-specific failures:

- DOM content cannot reliably appear both below and above the native surface;
- CSS clipping, rounded corners, transforms, scrolling, opacity, and backdrop
  blur do not apply to the native surface;
- window movement and DPI changes require manual geometry synchronization;
- focus, pointer routing, screenshots, screen capture, and automated tests can
  observe different window stacks;
- Windows HWND airspace and macOS view/layer ordering require separate fixes.

If the main window needs a live model, a WebGL canvas in the WebView keeps the
model and UI in one compositor. A static image or thumbnail is also valid for
an early migration slice. A native-over-WebView overlay is not.

## Dual-renderer boundary

The target can contain Cubism Web in the main window and Cubism Native in the
desktop companion. This duplicates rendering adapters, not domain behavior.

Before both renderers can ship together, they need explicit parity evidence for:

- supported model and asset versions;
- motion groups, expression identifiers, parameter ranges, and priorities;
- scale, crop, color, alpha, and texture behavior;
- hit-area naming and normalized pointer coordinates;
- idle, speaking, hidden, and suspended frame policies.

Pixel-identical output is not required, but user-visible behavior must not
contradict the same engine state. No current v1 protocol carries these intents,
so synchronized dual rendering remains future work.

## State and event direction

The desired dependency direction is:

```text
user input -> application command -> C++ engine
C++ engine -> immutable snapshot / high-level intent -> presentation adapter
```

The frontend may keep ephemeral UI state such as selected tabs and form drafts.
The Stage may keep rendering-local state such as its current frame and GPU
resources. Neither is allowed to independently decide persistent companion
state.

## Process and security boundary

- Tauri starts the packaged Stage executable as a child process.
- Interactive control uses stdin/stdout JSONL; stderr is reserved for logs.
- No unauthenticated localhost control port is part of this design.
- Tauri capabilities allow only the packaged Stage binary and required args.
- Protocol messages do not carry shell commands, account tokens, or arbitrary
  executables.
- Parent exit, broken protocol streams, and child crashes must have defined
  cleanup and restart behavior before release.

## Explicit non-goals for v0

- Removing the Qt code before a replacement passes the migration gates.
- Claiming the current Tauri scaffold is the default production entry point.
- Claiming the unversioned Stage stream implements protocol v1.
- Sharing a native OpenGL texture directly with the WebView.
- Streaming raw frames through JSONL.
- Moving engine rules into TypeScript, Rust UI handlers, or renderer code.

