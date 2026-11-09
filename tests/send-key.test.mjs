import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-send-key-"));
let keys;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./send-key-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  keys = await import(pathToFileURL(join(output, "send-key.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const press = (key, options = {}) => ({ key, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, isComposing: false, ...options });

test("Enter 发送模式：Enter 发送，Shift + Enter 换行，非 Enter 键不处理", () => {
  assert.equal(keys.sendKeyAction(press("Enter"), "enter"), "send");
  assert.equal(keys.sendKeyAction(press("Enter", { metaKey: true }), "enter"), "send");
  assert.equal(keys.sendKeyAction(press("Enter", { shiftKey: true }), "enter"), "newline");
  assert.equal(keys.sendKeyAction(press("a"), "enter"), undefined);
});

test("组合键发送模式：只有 ⌘ / Ctrl + Enter 发送，普通 Enter 和 Shift + Enter 都换行", () => {
  assert.equal(keys.sendKeyAction(press("Enter"), "mod-enter"), "newline");
  assert.equal(keys.sendKeyAction(press("Enter", { shiftKey: true }), "mod-enter"), "newline");
  assert.equal(keys.sendKeyAction(press("Enter", { metaKey: true }), "mod-enter"), "send");
  assert.equal(keys.sendKeyAction(press("Enter", { ctrlKey: true }), "mod-enter"), "send");
  assert.equal(keys.sendKeyAction(press("Enter", { ctrlKey: true, shiftKey: true }), "mod-enter"), "newline");
});

test("输入法组合中按 Enter 不发送；未知设置值按 Enter 发送处理", () => {
  for (const mode of ["enter", "mod-enter"]) {
    assert.equal(keys.sendKeyAction(press("Enter", { isComposing: true, metaKey: true }), mode), undefined);
    assert.equal(keys.sendKeyAction(press("Enter", { keyCode: 229 }), mode), undefined);
  }
  assert.equal(keys.normalizeSendKeyMode("mod-enter"), "mod-enter");
  assert.equal(keys.normalizeSendKeyMode("bogus"), "enter");
  assert.equal(keys.normalizeSendKeyMode(undefined), "enter");
});
