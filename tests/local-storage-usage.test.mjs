import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-local-storage-usage-"));
let measureLocalStorage, formatStorageSize;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./local-storage-usage-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  ({ measureLocalStorage, formatStorageSize } = await import(pathToFileURL(join(output, "settings/local-storage-usage.js"))));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const storageOf = (entries) => {
  const keys = Object.keys(entries);
  return { length: keys.length, key: (index) => keys[index] ?? null, getItem: (key) => entries[key] ?? null };
};

test("本机存储按数据归属分类，只统计 NekoPapa 键并保留未知键", () => {
  const usage = measureLocalStorage(storageOf({
    "nekopapa.settings.v1": "{}",
    "nekopapa.settings.v1.previous": "{\"a\":1}",
    "nekopapa:chat-threads:v1": "[]",
    "nekopapa.contacts.v1": "[]",
    "nekopapa.group-chats.v1": "[]",
    "nekopapa.future-feature": "x",
    "another-app": "ignored",
  }));
  const byId = Object.fromEntries(usage.categories.map((category) => [category.id, category]));
  assert.equal(byId.settings.bytes, ("nekopapa.settings.v1".length + 2) * 2);
  assert.equal(byId.settings.inSettingsBackup, true);
  assert.equal(byId["settings-backup"].entries, 1);
  assert.equal(byId.chats.inSettingsBackup, false);
  assert.equal(byId.contacts.entries, 2);
  assert.equal(byId.other.entries, 1);
  assert.equal(usage.totalBytes, usage.categories.reduce((total, category) => total + category.bytes, 0));
  assert.ok(!JSON.stringify(usage).includes("another-app"));
});

test("没有未知键时不显示“其他”，空存储总量为 0", () => {
  const usage = measureLocalStorage(storageOf({}));
  assert.equal(usage.totalBytes, 0);
  assert.equal(usage.categories.some((category) => category.id === "other"), false);
  assert.ok(usage.categories.every((category) => category.bytes === 0 && category.entries === 0));
});

test("存储大小以 KB / MB 显示，非零值不显示为 0", () => {
  assert.equal(formatStorageSize(0), "0 KB");
  assert.equal(formatStorageSize(10), "0.1 KB");
  assert.equal(formatStorageSize(1536), "1.5 KB");
  assert.equal(formatStorageSize(3 * 1024 * 1024), "3 MB");
});
