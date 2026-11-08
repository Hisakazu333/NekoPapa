import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-language-store-"));
let module;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./application-language-store-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), "{\"type\":\"module\"}");
  module = await import(pathToFileURL(join(output, "application-language-store.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const { ApplicationLanguageStore, applicationLanguageKey } = module;
const legacyKey = "nekopapa.settings.v1";
function memory(entries = []) {
  const values = new Map(entries);
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("迁移旧外观语言到独立存储且不改写原设置", () => {
  const legacy = JSON.stringify({ groups: { appearance: { mode: "dark", language: "en-US" } } });
  const storage = memory([[legacyKey, legacy]]);
  const store = new ApplicationLanguageStore(storage);
  assert.equal(store.language, "en-US");
  assert.equal(storage.getItem(applicationLanguageKey), "en-US");
  assert.equal(storage.getItem(legacyKey), legacy);
});

test("有效的新语言优先于旧配置，无效新值回退简体中文", () => {
  const legacy = JSON.stringify({ groups: { appearance: { language: "en-US" } } });
  assert.equal(new ApplicationLanguageStore(memory([[legacyKey, legacy], [applicationLanguageKey, "zh-CN"]])).language, "zh-CN");
  assert.equal(new ApplicationLanguageStore(memory([[applicationLanguageKey, "ja"]])).language, "zh-CN");
});

test("保存失败不改变当前语言或通知订阅者，重试成功后通知一次", () => {
  const storage = memory();
  let fail = true;
  const store = new ApplicationLanguageStore({ getItem: storage.getItem, setItem: (key, value) => {
    if (fail) throw new Error("storage full");
    storage.setItem(key, value);
  } });
  let changes = 0;
  store.subscribe(() => changes++);
  assert.match(store.setLanguage("en-US"), /无法保存/);
  assert.equal(store.language, "zh-CN");
  assert.equal(changes, 0);
  fail = false;
  assert.equal(store.setLanguage("en-US"), null);
  assert.equal(store.language, "en-US");
  assert.equal(changes, 1);
});

test("跨窗口更新验证存储值并在移除设置后回退默认语言", () => {
  const storage = memory();
  const store = new ApplicationLanguageStore(storage);
  let changes = 0;
  store.subscribe(() => changes++);
  store.reload("en-US");
  store.reload("unsupported");
  assert.equal(store.language, "zh-CN");
  assert.equal(changes, 2);
  storage.values.set(legacyKey, JSON.stringify({ groups: { appearance: { language: "en-US" } } }));
  store.reload(null);
  assert.equal(store.language, "en-US");
  assert.equal(changes, 3);
});
