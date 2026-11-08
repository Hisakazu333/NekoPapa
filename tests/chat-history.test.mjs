import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-chat-history-"));
let history;
let storageModule;
let contactsModule;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./chat-history-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  function qualify(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) qualify(path);
      else if (path.endsWith(".js")) writeFileSync(path, readFileSync(path, "utf8").replace(
        /(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g,
        (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`,
      ));
    }
  }
  qualify(output);
  history = await import(pathToFileURL(join(output, "app/chat-history-store.js")));
  storageModule = await import(pathToFileURL(join(output, "components/application/agent-chat/thread-storage.js")));
  contactsModule = await import(pathToFileURL(join(output, "app/contacts-store.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const { ChatHistoryStore } = history;
const { CHAT_STORAGE_KEY, LEGACY_CHAT_STORAGE_KEY, readThreads } = storageModule;
const { ContactsStore, CONTACTS_STORAGE_KEY } = contactsModule;
const envelope = (threads) => JSON.stringify({ version: 1, legacyMigrated: true, threads });
function thread(id, updatedAt = 100) {
  return {
    id, title: `${id} 的聊天`, updatedAt, messages: [
      { id: `${id}-message`, role: "user", parts: [{ type: "text", text: `发给 ${id}` }] },
    ], messageAt: { [`${id}-message`]: updatedAt },
  };
}
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values, writes: [], failRead: false, failWrite: false,
    getItem(key) { if (this.failRead) throw new Error("read blocked"); return values.get(key) ?? null; },
    setItem(key, value) { if (this.failWrite) throw new Error("quota"); this.writes.push(key); values.set(key, value); },
  };
}

test("初次订阅只恢复历史，空记录与旧记录均不会自动写回", () => {
  for (const initial of [{}, { [LEGACY_CHAT_STORAGE_KEY]: JSON.stringify([thread("legacy")]) }]) {
    const storage = memoryStorage(initial);
    const store = new ChatHistoryStore(storage);
    assert.equal(store.getSnapshot().ready, false);
    const unsubscribe = store.subscribe(() => {});
    assert.equal(store.getSnapshot().ready, true);
    assert.equal(store.getSnapshot().writable, true);
    assert.equal(storage.writes.length, 0);
    store.initialize();
    store.reload();
    assert.equal(storage.writes.length, 0);
    unsubscribe();
  }
});

test("删除联系人清理全部单聊并保留其他联系人、工作台及群聊原文", () => {
  const storage = memoryStorage();
  const contacts = new ContactsStore(storage);
  const removed = contacts.create({ name: "将删除", description: "" }).contact;
  const kept = contacts.create({ name: "继续保留", description: "" }).contact;
  const removedThreads = ["first", "second"].map((id) => ({ ...thread(id), contact: removed }));
  const keptThread = { ...thread("kept"), contact: kept };
  const workspace = thread("workspace");
  storage.values.set(CHAT_STORAGE_KEY, envelope([...removedThreads, keptThread, workspace]));
  storage.values.set("nekopapa.group-chats.v1", "existing group snapshot");
  const history = new ChatHistoryStore(storage);
  history.initialize();
  assert.equal(history.removeContactThreads(removed.id), false);
  assert.equal(contacts.remove(removed.id), true);
  assert.equal(history.removeContactThreads(removed.id), true);
  assert.deepEqual(new Set(readThreads(storage).threads.map((item) => item.id)), new Set([keptThread.id, workspace.id]));
  assert.equal(storage.values.get("nekopapa.group-chats.v1"), "existing group snapshot");
  assert.equal(new ContactsStore(storage).contacts.some((contact) => contact.id === kept.id), true);
});

test("另一个窗口与迟到回复不能恢复已删除联系人的单聊", () => {
  const storage = memoryStorage();
  const contacts = new ContactsStore(storage);
  const contact = contacts.create({ name: "流式联系人", description: "" }).contact;
  const original = { ...thread("stream"), contact };
  const first = new ChatHistoryStore(storage);
  const second = new ChatHistoryStore(storage);
  first.upsertThread(original);
  second.initialize();
  assert.equal(contacts.remove(contact.id), true);
  assert.equal(first.removeContactThreads(contact.id), true);
  second.upsertThread({ ...original, updatedAt: 300 });
  second.reload();
  assert.deepEqual(second.getSnapshot().threads, []);
  assert.deepEqual(new ChatHistoryStore(storage).getSnapshot().threads, []);
  const fresh = new ChatHistoryStore(storage);
  fresh.initialize();
  fresh.upsertThread(original);
  assert.deepEqual(readThreads(storage).threads, []);
});

test("删除后的历史清理失败可明确重试，失败期间隐藏原单聊并丢弃待写回复", () => {
  const storage = memoryStorage();
  let failHistoryWrite = false;
  const target = {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => {
      if (failHistoryWrite && key === CHAT_STORAGE_KEY) throw new Error("history quota");
      storage.setItem(key, value);
    },
  };
  const contacts = new ContactsStore(target);
  const contact = contacts.create({ name: "失败重试", description: "" }).contact;
  const original = { ...thread("deleted"), contact };
  const keep = thread("keep");
  const history = new ChatHistoryStore(target);
  history.upsertThread(original); history.upsertThread(keep);
  failHistoryWrite = true;
  history.upsertThread({ ...original, updatedAt: 500 });
  assert.ok(history.getSnapshot().error);
  assert.equal(contacts.remove(contact.id), true);
  const before = storage.values.get(CHAT_STORAGE_KEY);
  assert.equal(history.removeContactThreads(contact.id), false);
  assert.equal(storage.values.get(CHAT_STORAGE_KEY), before);
  assert.deepEqual(history.getSnapshot().threads, [keep]);
  history.upsertThread({ ...original, updatedAt: 600 });
  failHistoryWrite = false;
  assert.equal(history.removeContactThreads(contact.id), true);
  assert.deepEqual(readThreads(storage).threads, [keep]);
  assert.equal(history.getSnapshot().error, null);
});

test("读取删除记录失败阻止历史写入，恢复后继续遵守已提交的删除标记", () => {
  const storage = memoryStorage();
  const contacts = new ContactsStore(storage);
  const contact = contacts.create({ name: "读取故障", description: "" }).contact;
  const original = { ...thread("old"), contact };
  const history = new ChatHistoryStore(storage);
  history.upsertThread(original);
  assert.equal(contacts.remove(contact.id), true);
  const valid = storage.values.get(CONTACTS_STORAGE_KEY);
  const before = storage.values.get(CHAT_STORAGE_KEY);
  storage.values.set(CONTACTS_STORAGE_KEY, "broken ledger");
  history.upsertThread({ ...original, updatedAt: 900 });
  assert.ok(history.getSnapshot().error);
  assert.equal(storage.values.get(CHAT_STORAGE_KEY), before);
  storage.values.set(CONTACTS_STORAGE_KEY, valid);
  history.retryHistory();
  assert.deepEqual(readThreads(storage).threads, []);
});

test("工作台与多位联系人的交错保存按ID合并，不覆盖其他消息或更新时间", () => {
  const storage = memoryStorage();
  const store = new ChatHistoryStore(storage);
  const workspace = thread("workspace", 100);
  const lumia = { ...thread("lumia", 200), contact: { id: "lumia", kind: "official", name: "白羽澪", description: "嘴硬照顾 · 主看板" } };
  const rinne = { ...thread("rinne", 300), contact: { id: "rinne", kind: "official", name: "雪代凛音", description: "安静有序 · 说到做到" } };
  store.upsertThread(workspace);
  store.upsertThread(lumia);
  store.upsertThread(rinne);
  const continued = { ...workspace, updatedAt: 400, messages: [...workspace.messages, { id: "workspace-followup", role: "user", parts: [{ type: "text", text: "继续工作" }] }] };
  store.upsertThread(continued);
  assert.deepEqual(store.getSnapshot().threads, [continued, rinne, lumia]);
  assert.deepEqual(readThreads(storage).threads, [continued, rinne, lumia]);
  assert.equal(readThreads(storage).threads.find((item) => item.id === "lumia").updatedAt, 200);
});

test("两个窗口交错写入时读取最新存储，重命名只改名称而不回退新消息", () => {
  const original = thread("one");
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: envelope([original]) });
  const first = new ChatHistoryStore(storage);
  const second = new ChatHistoryStore(storage);
  first.initialize(); second.initialize();
  const remote = thread("remote", 200);
  second.upsertThread(remote);
  first.upsertThread(thread("local", 300));
  const advanced = { ...original, updatedAt: 500, messages: [...original.messages, { id: "new", role: "assistant", parts: [{ type: "text", text: "真实新消息" }] }] };
  second.upsertThread(advanced);
  first.renameThread(original.id, "手动改名");
  const saved = readThreads(storage).threads;
  assert.equal(saved.length, 3);
  assert.deepEqual(saved.find((item) => item.id === "one"), { ...advanced, title: "手动改名" });
  assert.deepEqual(saved.find((item) => item.id === "remote"), remote);
});

test("旧key首次操作只读迁移，删除同一ID后不会在下一次恢复中复活", () => {
  const original = thread("legacy");
  const raw = JSON.stringify([original]);
  const storage = memoryStorage({ [LEGACY_CHAT_STORAGE_KEY]: raw });
  const store = new ChatHistoryStore(storage);
  store.initialize();
  store.renameThread(original.id, "迁移后名称");
  assert.equal(store.getSnapshot().threads[0].id, original.id);
  store.toggleThreadUnread(original.id);
  assert.equal(store.getSnapshot().threads[0].unread, true);
  store.removeThread(original.id);
  store.reload();
  assert.deepEqual(store.getSnapshot().threads, []);
  assert.deepEqual(readThreads(storage).threads, []);
  assert.equal(storage.getItem(LEGACY_CHAT_STORAGE_KEY), raw);
});

test("单条删除写入失败时保留会话且不把删除排队，重新确认成功后才删除", () => {
  const original = thread("retry-delete");
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: envelope([original]) });
  const store = new ChatHistoryStore(storage);
  store.initialize();

  storage.failWrite = true;
  assert.equal(store.removeThread(original.id), false);
  assert.deepEqual(store.getSnapshot().threads, [original]);
  assert.deepEqual(readThreads(storage).threads, [original]);

  storage.failWrite = false;
  store.retryHistory();
  assert.deepEqual(readThreads(storage).threads, [original]);
  assert.equal(store.removeThread(original.id), true);
  assert.deepEqual(store.getSnapshot().threads, []);
  assert.deepEqual(readThreads(storage).threads, []);
});

test("损坏历史阻止删除写入，恢复后会话仍在且必须重新确认删除", () => {
  const kept = thread("kept", 100);
  const removed = thread("removed", 200);
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: envelope([kept, removed]) });
  const store = new ChatHistoryStore(storage);
  store.initialize();
  storage.values.set(CHAT_STORAGE_KEY, "broken history");
  store.reload();
  assert.equal(store.getSnapshot().writable, false);
  const local = thread("unsaved", 300);
  store.upsertThread(local);
  assert.equal(store.removeThread("removed"), false);
  store.renameThread("kept", "本机未保存的名称");
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), "broken history");
  assert.equal(storage.writes.length, 0);
  assert.deepEqual(store.getSnapshot().threads.map((item) => item.id), ["unsaved", "removed", "kept"]);
  const remote = thread("remote", 250);
  storage.values.set(CHAT_STORAGE_KEY, envelope([kept, removed, remote]));
  store.retryHistory();
  assert.equal(store.getSnapshot().error, null);
  assert.equal(store.getSnapshot().writable, true);
  assert.deepEqual(readThreads(storage).threads, [local, remote, removed, { ...kept, title: "本机未保存的名称" }]);
  assert.equal(store.removeThread(removed.id), true);
  assert.deepEqual(readThreads(storage).threads, [local, remote, { ...kept, title: "本机未保存的名称" }]);
});

test("初次读取不可用时仍保留当前新会话，恢复后不会覆盖尚未读取的历史", () => {
  const previous = thread("previous", 100);
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: envelope([previous]) });
  storage.failRead = true;
  const store = new ChatHistoryStore(storage);
  store.initialize();
  assert.equal(store.getSnapshot().writable, false);
  const local = thread("local", 200);
  store.upsertThread(local);
  assert.deepEqual(store.getSnapshot().threads, [local]);
  assert.equal(storage.writes.length, 0);
  storage.failRead = false;
  store.retryHistory();
  assert.deepEqual(readThreads(storage).threads, [local, previous]);
});

test("写入失败保留所有内存变更，重试时同时保留另一窗口的新会话", () => {
  const original = thread("original");
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: envelope([original]) });
  const store = new ChatHistoryStore(storage);
  store.initialize();
  storage.failWrite = true;
  const local = thread("local", 300);
  store.upsertThread(local);
  store.renameThread("original", "待保存名称");
  assert.ok(store.getSnapshot().error);
  assert.equal(store.getSnapshot().writable, true);
  assert.equal(store.getSnapshot().threads.length, 2);
  assert.deepEqual(readThreads(storage).threads, [original]);
  const remote = thread("remote", 200);
  storage.values.set(CHAT_STORAGE_KEY, envelope([original, remote]));
  store.reload();
  assert.deepEqual(store.getSnapshot().threads, [local, remote, { ...original, title: "待保存名称" }]);
  storage.failWrite = false;
  store.retryHistory();
  assert.equal(store.getSnapshot().error, null);
  assert.deepEqual(readThreads(storage).threads, store.getSnapshot().threads);
});

test("外部更新替换干净快照和删除结果，刷新本身不产生存储回写", () => {
  const original = thread("original");
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: envelope([original]) });
  const store = new ChatHistoryStore(storage);
  store.initialize();
  const remote = thread("remote", 200);
  storage.values.set(CHAT_STORAGE_KEY, envelope([remote]));
  store.reload();
  assert.deepEqual(store.getSnapshot().threads, [remote]);
  assert.equal(storage.writes.length, 0);
  storage.values.set(CHAT_STORAGE_KEY, envelope([]));
  store.reload();
  assert.deepEqual(store.getSnapshot().threads, []);
  assert.equal(storage.writes.length, 0);
});

test("两位联系人反复恢复与保存时忽略对象键顺序，不再次写入或发布快照", () => {
  const contacts = [
    { id: "lumia", name: "白羽澪", description: "嘴硬照顾", avatar: "/characters/lumia-avatar.jpg", kind: "official" },
    { id: "rinne", name: "雪代凛音", description: "安静有序", avatar: "/characters/rinne-avatar.webp", kind: "official" },
  ];
  const originals = contacts.map((contact, index) => ({ ...thread(contact.id, 100 + index), contact }));
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: envelope(originals) });
  const store = new ChatHistoryStore(storage);
  store.initialize();
  let publications = 0;
  const unsubscribe = store.subscribe(() => { publications++; });
  const snapshot = store.getSnapshot();
  // Reading normalizes contact keys; the live catalog spreads them in another order.
  for (let pass = 0; pass < 20; pass++) for (const original of originals) {
    const hydrated = readThreads(storage).threads.find((item) => item.id === original.id);
    assert.notEqual(JSON.stringify(hydrated.contact), JSON.stringify(original.contact));
    store.upsertThread({ ...hydrated, contact: original.contact });
  }
  assert.equal(publications, 0);
  assert.equal(storage.writes.length, 0);
  assert.equal(store.getSnapshot(), snapshot);

  const before = store.getSnapshot().threads.find((item) => item.id === "lumia");
  const edited = { ...before, updatedAt: 300, messages: [...before.messages,
    { id: "new-reply", role: "assistant", parts: [{ text: "真正新增回复", type: "text" }] }] };
  store.upsertThread(edited);
  assert.equal(publications, 1);
  assert.equal(storage.writes.length, 1);
  assert.deepEqual(readThreads(storage).threads.find((item) => item.id === "lumia").messages, edited.messages);
  for (let pass = 0; pass < 10; pass++) store.upsertThread({ ...readThreads(storage).threads[0], contact: contacts[0] });
  assert.equal(publications, 1);
  assert.equal(storage.writes.length, 1);
  unsubscribe();
});
