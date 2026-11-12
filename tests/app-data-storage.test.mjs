import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Desktop chat history kept as a file in the data folder (platform/app-data-storage.ts).
const output = mkdtempSync(join(tmpdir(), "nekopapa-app-data-"));
let files, history, storageModule;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./chat-history-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  const qualify = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) qualify(path);
      else if (path.endsWith(".js")) writeFileSync(path, readFileSync(path, "utf8").replace(
        /(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g,
        (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`,
      ));
    }
  };
  qualify(output);
  files = await import(pathToFileURL(join(output, "platform/app-data-storage.js")));
  history = await import(pathToFileURL(join(output, "app/chat/chat-history-store.js")));
  storageModule = await import(pathToFileURL(join(output, "components/application/agent-chat/thread-storage.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const { AppDataStorage, migrateFromWebView, DataFolderError } = files;
const { ChatHistoryStore } = history;
const { CHAT_STORAGE_KEY, readThreads } = storageModule;

function webView(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}
/** Stands in for the host: records writes, can fail, can be held to test ordering. */
function disk() {
  const written = [];
  let failing = null;
  return {
    written,
    fail(reason) { failing = reason; },
    write: async (name, text) => { await new Promise((resolve) => setTimeout(resolve, 1)); if (failing) throw failing; written.push([name, text]); },
  };
}
const thread = (id) => ({ id, title: id, updatedAt: 1, messages: [{ id: `${id}-m`, role: "user", parts: [{ type: "text", text: id }] }], messageAt: {} });
const envelope = (threads) => JSON.stringify({ version: 1, legacyMigrated: true, threads });

test("chat history reads from the file and every save is written to disk in order; other keys stay in WebView storage", async () => {
  const host = disk();
  const view = webView({ "nekopapa.contacts.v1": "contacts" });
  const storage = new AppDataStorage(host, view, new Map([["chat-threads", envelope([thread("a")])]]));
  assert.deepEqual(readThreads(storage).threads.map((item) => item.id), ["a"]);
  storage.setItem(CHAT_STORAGE_KEY, "1");
  storage.setItem(CHAT_STORAGE_KEY, "2");
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), "2");
  assert.equal(storage.status().pending, 2);
  await storage.settled();
  assert.deepEqual(host.written, [["chat-threads", "1"], ["chat-threads", "2"]]);
  assert.deepEqual(storage.status(), { pending: 0, error: null });
  assert.equal(storage.getItem("nekopapa.contacts.v1"), "contacts");
  storage.setItem("nekopapa.contacts.v1", "changed");
  assert.equal(view.values.get("nekopapa.contacts.v1"), "changed");
  assert.equal(view.values.has(CHAT_STORAGE_KEY), false);
  assert.throws(() => storage.removeItem(CHAT_STORAGE_KEY));
});

test("first start moves chat history out of WebView storage and leaves the WebView copy as a backup", () => {
  const view = webView({ [CHAT_STORAGE_KEY]: envelope([thread("old")]) });
  const found = new Map();
  assert.deepEqual(migrateFromWebView(found, view), [{ key: CHAT_STORAGE_KEY, text: envelope([thread("old")]) }]);
  assert.equal(found.get("chat-threads"), envelope([thread("old")]));
  assert.equal(view.values.has(CHAT_STORAGE_KEY), true);
  // Once the file exists it wins and nothing is moved again.
  assert.deepEqual(migrateFromWebView(new Map([["chat-threads", "file"]]), view), []);
});

test("an unreadable data folder blocks saving, so an empty history never replaces the file", () => {
  const host = disk();
  const storage = new AppDataStorage(host, webView(), new Map(), "无法读取本机数据文件夹中的聊天记录（权限不足），已阻止覆盖原文件。");
  assert.throws(() => storage.getItem(CHAT_STORAGE_KEY), DataFolderError);
  const store = new ChatHistoryStore(storage);
  store.initialize();
  assert.equal(store.getSnapshot().writable, false);
  assert.match(store.getSnapshot().error, /权限不足/);
  store.upsertThread(thread("new"));
  assert.equal(host.written.length, 0);
  assert.equal(store.getSnapshot().threads.some((item) => item.id === "new"), true, "the new chat stays on screen");
});

test("a failed disk write shows as a history error and clears after a successful retry", async () => {
  const host = disk();
  const storage = new AppDataStorage(host, webView(), new Map());
  const store = new ChatHistoryStore(storage);
  store.initialize();
  storage.subscribe(() => store.reportStorageError(storage.status().error));
  host.fail("无法写入 chat-threads.json，原文件保持不变。");
  store.upsertThread(thread("a"));
  await storage.settled();
  assert.equal(storage.status().error, "无法写入 chat-threads.json，原文件保持不变。");
  assert.equal(store.getSnapshot().error, "无法写入 chat-threads.json，原文件保持不变。");
  host.fail(null);
  store.retryHistory();
  await storage.settled();
  assert.equal(store.getSnapshot().error, null);
  assert.deepEqual(JSON.parse(host.written.at(-1)[1]).threads.map((item) => item.id), ["a"]);
});
