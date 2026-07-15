# OpenNeko Stage Protocol v1

Status: draft contract. Implementation status: v0, not v1 compliant end to end.

This directory defines the proposed JSON Lines (JSONL) contract between the
Tauri desktop host and the independent native Live2D Stage process. The schema
is a target interface. Its presence does not mean that either process already
implements every rule in this document.

## Current v0 state

At the time this contract was added, the native Stage accepts unversioned JSON
objects with `command` or `cmd` fields and emits unversioned objects with an
`event` field. The observed lifecycle commands are `show`, `hide`, `shutdown`,
and `set_passthrough`. The Stage also has one-shot health output.

The v0 stream has no required handshake, protocol version, message identifier,
or stable error envelope. The Tauri and Stage implementations must therefore be
treated as incompatible with v1 until an explicit adapter or v1 parser is
implemented and tested.

## Scope

Protocol v1 intentionally covers only process lifecycle and window behavior:

- protocol handshake;
- show and hide;
- whole-window mouse passthrough;
- graceful shutdown;
- ready, command result, health, stopped, and error events.

The following are out of scope for v1:

- model hot loading or model-library operations;
- per-frame mouth, gaze, physics, or expression values;
- motion scheduling;
- hit-area or pointer events;
- audio or image transport;
- account, memory, Agent, or backend APIs.

Those features require separate contracts and performance budgets. They must
not be added as undocumented fields to v1 messages.

## Transport

Interactive mode uses the Stage child process standard streams:

- Tauri host to Stage: UTF-8 JSONL on `stdin`;
- Stage to Tauri host: UTF-8 JSONL on `stdout`;
- human-readable diagnostics: `stderr` only.

Each line contains exactly one compact JSON object followed by `\n`. Embedded
newlines are escaped by JSON encoding. Blank lines are ignored. Pretty-printed
multi-line JSON is invalid. Both processes must flush after writing a complete
line.

Protocol output must never be mixed with log text on `stdout`. A receiver must
treat malformed JSON, an unsupported version, and a message that fails its
schema as protocol errors rather than attempting best-effort coercion.

## Envelope

Every v1 message contains:

- `protocol_version`: exactly `"1.0"`;
- `kind`: `"command"` or `"event"`;
- `type`: a namespaced message type;
- `message_id`: an identifier unique for the lifetime of the process;
- `payload`: an object defined by the corresponding schema.

Events that answer a command also contain `reply_to`, set to the command's
`message_id`. Message identifiers are opaque. Receivers must not infer time or
ordering from their content.

## Interactive lifecycle

1. The Tauri host starts the sidecar with protocol output reserved for stdout.
2. The host sends `stage.handshake` as the first command.
3. The Stage either emits `stage.ready` with `reply_to` set to the handshake ID,
   or emits `stage.error` and exits.
4. The host sends lifecycle commands only after `stage.ready`.
5. Each accepted command after the handshake produces
   `stage.command_result`.
6. The Stage emits `stage.stopped` before a graceful process exit when possible.

In one-shot health-check mode there is no interactive handshake. The process
emits one `stage.health` event and exits with a meaningful status code.

## Result semantics

`stage.handshake` is answered by `stage.ready` or `stage.error`, not by a
separate command result. For later commands,
`stage.command_result.payload.ok` means the Stage applied the requested
lifecycle operation before sending the result. It is not a promise about later
window-system behavior. For example, an operating system may subsequently
change focus or visibility.

An unsupported command or invalid command payload receives a failed
`stage.command_result` when the command envelope and ID can be recovered.
Malformed input that cannot be correlated receives `stage.error` without
`reply_to`.

## Versioning

- Breaking envelope or semantic changes require a new major directory.
- Compatible additions require a new minor schema and explicit negotiation.
- Unknown message types are rejected; they are not silently ignored.
- Unknown object properties are rejected by the v1 schemas.
- A v0 implementation must not label its messages as v1.

## Security requirements

- The Stage is a child process, not a localhost network service.
- Tauri capabilities must allow only the packaged Stage sidecar.
- The protocol never accepts shell commands or arbitrary executable paths.
- v1 messages do not expose access tokens, account data, or absolute model
  paths.
- Logs must redact user paths and secrets before release builds.

## Files

- `message.schema.json`: union of all v1 commands and events.
- `command.schema.json`: host-to-Stage commands.
- `event.schema.json`: Stage-to-host events.
- `examples/*.jsonl`: illustrative valid v1 messages, not runtime proof.

## v0 to v1 mapping

| Observed v0 shape | Proposed v1 type |
| --- | --- |
| `{"command":"show","id":"42"}` | `stage.show` command |
| `{"command":"hide","id":"43"}` | `stage.hide` command |
| `{"command":"set_passthrough","enabled":true}` | `stage.set_passthrough` command |
| `{"command":"shutdown","id":"44"}` | `stage.shutdown` command |
| `{"event":"ready",...}` | `stage.ready` event |
| `{"event":"command_result",...}` | `stage.command_result` event |
| `{"event":"health",...}` | `stage.health` event |
| `{"event":"stopped",...}` | `stage.stopped` event |

The mapping is migration guidance only. It is not implemented by these files.
