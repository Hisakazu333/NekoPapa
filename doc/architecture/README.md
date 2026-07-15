# Desktop Architecture Notes

Status: migration planning, v0 implementation.

These documents describe the target desktop split without claiming that the
target already exists end to end.

- [Desktop runtime boundaries](desktop-runtime-boundaries.md): ownership of the
  Tauri host, Cubism Web surface, native Stage, and C++ engine.
- [Qt to Tauri migration](qt-to-tauri-migration.md): staged migration, rollback
  points, and the repository-history warning.
- [Build and test gates](build-and-test-gates.md): evidence required before the
  Tauri entry point or a release can be called ready.
- [Stage protocol v1](../../protocol/stage/v1/README.md): draft JSONL lifecycle
  contract between the Tauri host and native Stage.

## Meaning of v0

`v0` means scaffolding or local implementation may exist, but compatibility,
packaging, and runtime behavior have not passed the gates in this directory.
Screens, protocol schemas, or successful compilation alone do not promote a
component out of v0.

