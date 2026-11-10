import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-sidebar-visibility-"));
let visibility;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./sidebar-visibility-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), "{\"type\":\"module\"}");
  visibility = await import(pathToFileURL(join(output, "app/navigation/sidebar-visibility.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const { readSidebarHidden, writeSidebarHidden, isSidebarToggleShortcut, sidebarToggleShortcut, SIDEBAR_HIDDEN_KEY } = visibility;
const memory = () => { const map = new Map(); return { map, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) }; };
const key = (overrides) => ({ key: "b", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, isComposing: false, repeat: false, ...overrides });

test("the hidden sidebar is remembered and read back", () => {
  const storage = memory();
  assert.equal(readSidebarHidden(storage), false);
  assert.equal(writeSidebarHidden(storage, true), true);
  assert.equal(storage.map.get(SIDEBAR_HIDDEN_KEY), "1");
  assert.equal(readSidebarHidden(storage), true);
  writeSidebarHidden(storage, false);
  assert.equal(readSidebarHidden(storage), false);
});

test("unavailable or failing storage shows the sidebar and reports the failed save", () => {
  const failing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
  assert.equal(readSidebarHidden(failing), false);
  assert.equal(readSidebarHidden(undefined), false);
  assert.equal(writeSidebarHidden(failing, true), false);
  assert.equal(writeSidebarHidden(undefined, true), false);
});

test("⌘B on macOS and Ctrl+B elsewhere toggle the sidebar, other chords do not", () => {
  assert.equal(sidebarToggleShortcut("MacIntel"), "⌘B");
  assert.equal(sidebarToggleShortcut("Win32"), "Ctrl+B");
  assert.equal(isSidebarToggleShortcut(key({ metaKey: true }), "MacIntel"), true);
  assert.equal(isSidebarToggleShortcut(key({ metaKey: true, key: "B" }), "MacIntel"), true);
  assert.equal(isSidebarToggleShortcut(key({ ctrlKey: true }), "MacIntel"), false);
  assert.equal(isSidebarToggleShortcut(key({ ctrlKey: true }), "Win32"), true);
  assert.equal(isSidebarToggleShortcut(key({ metaKey: true, shiftKey: true }), "MacIntel"), false);
  assert.equal(isSidebarToggleShortcut(key({ metaKey: true, repeat: true }), "MacIntel"), false);
  assert.equal(isSidebarToggleShortcut(key({ metaKey: true, isComposing: true }), "MacIntel"), false);
  assert.equal(isSidebarToggleShortcut(key({ metaKey: true, key: "l" }), "MacIntel"), false);
});
