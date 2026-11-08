import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-chat-storage-"));
let chat;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./chat-storage-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  function addExtensions(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name);
      if (entry.isDirectory()) addExtensions(file);
      else if (entry.name.endsWith(".js")) writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`));
    }
  }
  addExtensions(output);
  chat = await import(pathToFileURL(join(output, "components/application/agent-chat/thread-storage.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const { CHAT_STORAGE_KEY, LEGACY_CHAT_STORAGE_KEY, readThreads, writeThreads, orderThreads } = chat;
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return { values, writes, getItem: (key) => values.get(key) ?? null, setItem(key, value) { writes.push(key); values.set(key, value); } };
}
function thread(id = "one", updatedAt = 100) {
  return {
    id, title: `自定义名称 ${id}`, updatedAt, unread: true,
    messages: [
      { id: `${id}-user`, role: "user", parts: [{ type: "text", text: "BoardUI demo 是我自己输入的问题，不能按文案删除" }], metadata: { source: "user" } },
      { id: `${id}-assistant`, role: "assistant", parts: [{ type: "text", text: "保留此前回复" }, { type: "reasoning", text: "也保留非文本部分" }] },
    ],
    messageAt: { [`${id}-user`]: 90, [`${id}-assistant`]: 99 },
  };
}
function currentEnvelope(threads) { return JSON.stringify({ version: 1, legacyMigrated: true, threads }); }

test("首次打开无官方示例，会话历史和其他工作台存储完全隔离", () => {
  const storage = memoryStorage({ "boardui:agent-chat-demo": "on", "nekopapa.workspace": "unrelated" });
  const loaded = readThreads(storage);
  assert.deepEqual(loaded, { threads: [], writable: true, error: null, source: "empty" });
  assert.equal(storage.writes.length, 0);
  assert.equal(writeThreads([], loaded.writable, storage).saved, true);
  assert.equal(storage.getItem("boardui:agent-chat-demo"), "on");
  assert.equal(storage.getItem("nekopapa.workspace"), "unrelated");
  assert.deepEqual(storage.writes, [CHAT_STORAGE_KEY]);
});

test("旧 key 完整只读迁移到新 key，保留 ID、改名、消息、时间、未读与原顺序", () => {
  const threads = [thread("renamed", 5), thread("older", 50)];
  const raw = JSON.stringify(threads, null, 2);
  const storage = memoryStorage({ [LEGACY_CHAT_STORAGE_KEY]: raw });
  const loaded = readThreads(storage);
  assert.equal(loaded.source, "legacy");
  assert.equal(loaded.writable, true);
  assert.deepEqual(loaded.threads, threads);
  assert.equal(storage.writes.length, 0);
  assert.equal(writeThreads(loaded.threads, loaded.writable, storage).saved, true);
  assert.equal(storage.getItem(LEGACY_CHAT_STORAGE_KEY), raw);
  assert.deepEqual(JSON.parse(storage.getItem(CHAT_STORAGE_KEY)).threads, threads);
  assert.deepEqual(storage.writes, [CHAT_STORAGE_KEY]);
  assert.deepEqual(readThreads(storage).threads, threads);
});

test("超过 30 条旧历史不会被排序或保存静默截断", () => {
  const threads = Array.from({ length: 45 }, (_, index) => thread(`history-${index}`, index));
  const storage = memoryStorage({ [LEGACY_CHAT_STORAGE_KEY]: JSON.stringify(threads) });
  const loaded = readThreads(storage);
  assert.equal(loaded.threads.length, 45);
  const ordered = orderThreads(loaded.threads);
  assert.equal(ordered.length, 45);
  assert.equal(ordered[0].id, "history-44");
  assert.equal(loaded.threads[0].id, "history-0");
  assert.equal(writeThreads(ordered, loaded.writable, storage).saved, true);
  assert.equal(readThreads(storage).threads.length, 45);
});

test("已有新 key 裸数组合并旧 key 缺失会话，同一 ID 以当前修改为准", () => {
  const same = { ...thread("same"), title: "迁移后再次改名", unread: false };
  const current = [same, thread("new", 120)];
  const legacy = [thread("same"), thread("old", 70)];
  const raw = JSON.stringify(legacy);
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: JSON.stringify(current), [LEGACY_CHAT_STORAGE_KEY]: raw });
  const loaded = readThreads(storage);
  assert.equal(loaded.source, "current");
  assert.deepEqual(loaded.threads, [...current, legacy[1]]);
  assert.equal(writeThreads(loaded.threads, loaded.writable, storage).saved, true);
  assert.equal(storage.getItem(LEGACY_CHAT_STORAGE_KEY), raw);
});

test("旧版已误写空新数组时仍能恢复旧 key 会话", () => {
  const previous = thread("previous");
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: "[]", [LEGACY_CHAT_STORAGE_KEY]: JSON.stringify([previous]) });
  assert.deepEqual(readThreads(storage).threads, [previous]);
});

test("成功迁移后删除不会被只读旧 key 再次导入，连旧 key 都不必再访问", () => {
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: currentEnvelope([]), [LEGACY_CHAT_STORAGE_KEY]: JSON.stringify([thread()]) });
  const port = { getItem(key) { assert.notEqual(key, LEGACY_CHAT_STORAGE_KEY); return storage.getItem(key); } };
  const loaded = readThreads(port);
  assert.deepEqual(loaded.threads, []);
  assert.equal(loaded.writable, true);
  assert.equal(loaded.source, "current");
});

test("旧记录未包含 messageAt 时兼容为空映射，不丢消息元数据", () => {
  const previous = thread();
  delete previous.messageAt;
  const storage = memoryStorage({ [LEGACY_CHAT_STORAGE_KEY]: JSON.stringify([previous]) });
  const loaded = readThreads(storage);
  assert.equal(loaded.writable, true);
  assert.deepEqual(loaded.threads[0].messageAt, {});
  assert.deepEqual(loaded.threads[0].messages, previous.messages);
});

test("损坏的主 key 保持原文且关闭写入门禁，自动保存空数组也不能覆盖", () => {
  for (const raw of ["not JSON", "", '{"version":2,"threads":[]}', '[{"id":"broken"}]']) {
    const storage = memoryStorage({ [CHAT_STORAGE_KEY]: raw, [LEGACY_CHAT_STORAGE_KEY]: JSON.stringify([thread()]) });
    const loaded = readThreads(storage);
    assert.equal(loaded.writable, false);
    assert.ok(loaded.error);
    assert.equal(writeThreads([], loaded.writable, storage).saved, false);
    assert.equal(storage.getItem(CHAT_STORAGE_KEY), raw);
    assert.equal(storage.writes.length, 0);
  }
});

test("损坏的旧 key 不会被默认空值替代；已有当前历史仍可读取但不可覆盖", () => {
  const current = thread("current");
  for (const initial of [{}, { [CHAT_STORAGE_KEY]: JSON.stringify([current]) }]) {
    const storage = memoryStorage({ ...initial, [LEGACY_CHAT_STORAGE_KEY]: "broken legacy" });
    const loaded = readThreads(storage);
    assert.equal(loaded.writable, false);
    assert.deepEqual(loaded.threads, initial[CHAT_STORAGE_KEY] ? [current] : []);
    assert.equal(writeThreads(loaded.threads, loaded.writable, storage).saved, false);
    assert.equal(storage.getItem(LEGACY_CHAT_STORAGE_KEY), "broken legacy");
    assert.equal(storage.writes.length, 0);
  }
});

test("部分损坏、重复会话或消息 ID 和无效时间禁止整份历史写回", () => {
  const valid = thread();
  const invalidLists = [
    [valid, { id: "malformed" }], [valid, valid],
    [{ ...valid, messages: [valid.messages[0], valid.messages[0]] }],
    [{ ...valid, messageAt: { one: "yesterday" } }],
    [{ ...valid, messages: [{ ...valid.messages[0], parts: [{ type: "text", text: 123 }] }] }],
  ];
  for (const invalid of invalidLists) {
    const raw = JSON.stringify(invalid);
    const storage = memoryStorage({ [LEGACY_CHAT_STORAGE_KEY]: raw });
    assert.equal(readThreads(storage).writable, false);
    assert.equal(storage.getItem(LEGACY_CHAT_STORAGE_KEY), raw);
    assert.equal(storage.writes.length, 0);
  }
});

test("localStorage 属性 getter 被阻止时读取和写入都返回错误，不在函数入口抛出", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked getter"); } });
  try {
    const loaded = readThreads();
    assert.equal(loaded.writable, false);
    assert.equal(loaded.source, "unavailable");
    assert.deepEqual(loaded.threads, []);
    assert.equal(writeThreads([thread()], true).saved, false);
    assert.equal(writeThreads([], false).saved, false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});

test("存储读取失败保持门禁关闭，即使已有新历史也不写掉未读取的旧内容", () => {
  const current = thread("current");
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: JSON.stringify([current]) });
  let failLegacy = true;
  const port = {
    getItem(key) { if (key === LEGACY_CHAT_STORAGE_KEY && failLegacy) throw new Error("blocked read"); return storage.getItem(key); },
    setItem: storage.setItem,
  };
  const loaded = readThreads(port);
  assert.deepEqual(loaded.threads, [current]);
  assert.equal(loaded.writable, false);
  assert.equal(writeThreads(loaded.threads, loaded.writable, port).saved, false);
  assert.equal(storage.writes.length, 0);
  failLegacy = false;
  assert.equal(readThreads(port).writable, true);
});

test("首次迁移写入失败保留旧原文与内存历史，稍后重试可完整保存", () => {
  const previous = [thread("kept")];
  const raw = JSON.stringify(previous);
  const storage = memoryStorage({ [LEGACY_CHAT_STORAGE_KEY]: raw });
  let failWrite = true;
  const port = { getItem: storage.getItem, setItem(key, value) {
    if (failWrite) throw new Error("quota");
    storage.setItem(key, value);
  } };
  const loaded = readThreads(port);
  const result = writeThreads(loaded.threads, loaded.writable, port);
  assert.equal(result.saved, false);
  assert.ok(result.error);
  assert.deepEqual(loaded.threads, previous);
  assert.equal(storage.getItem(LEGACY_CHAT_STORAGE_KEY), raw);
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), null);
  failWrite = false;
  assert.equal(writeThreads(loaded.threads, loaded.writable, port).saved, true);
  assert.deepEqual(readThreads(port).threads, previous);
  assert.equal(storage.getItem(LEGACY_CHAT_STORAGE_KEY), raw);
});

test("常规保存失败不覆盖上次已保存历史，重试保存新消息与改名", () => {
  const original = thread();
  const raw = currentEnvelope([original]);
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: raw });
  const changed = { ...original, title: "新名称", messages: [...original.messages, { id: "follow-up", role: "user", parts: [{ type: "text", text: "继续" }] }] };
  const loaded = readThreads(storage);
  const failing = { setItem() { throw new Error("quota"); } };
  assert.equal(writeThreads([changed], loaded.writable, failing).saved, false);
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), raw);
  assert.equal(writeThreads([changed], loaded.writable, storage).saved, true);
  assert.deepEqual(readThreads(storage).threads, [changed]);
});

test("无效替换不能覆盖已有历史，消息角色必须是已支持的字符串", () => {
  const original = thread();
  const raw = currentEnvelope([original]);
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: raw });
  const invalid = { ...original, messages: [{ ...original.messages[0], role: ["user"] }] };
  assert.equal(writeThreads([invalid], true, storage).saved, false);
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), raw);
  assert.equal(storage.writes.length, 0);
});

test("联系人身份与历史同一ID保存，改名、排序、导出与重载保留原角色", () => {
  const contact = { id: "rinne", kind: "official", name: "雪代凛音", description: "安静有序 · 说到做到", avatar: "/characters/rinne-avatar.webp" };
  const customContact = { id: "contact-12345678-1234-4123-8123-123456789abc", kind: "custom", name: "我的搭子", description: "一起整理计划", tags: "大学课程", language: "zh-CN", avatarColor: "blue" };
  const first = { ...thread("official", 200), contact };
  const second = { ...thread("custom", 100), contact: customContact };
  const storage = memoryStorage({ [LEGACY_CHAT_STORAGE_KEY]: JSON.stringify([first, second]) });
  const loaded = readThreads(storage);
  assert.equal(loaded.writable, true);
  assert.deepEqual(loaded.threads.map((saved) => saved.contact), [contact, customContact]);
  const renamed = { ...loaded.threads[0], title: "同一角色的新标题", unread: false };
  const ordered = orderThreads([loaded.threads[1], renamed]);
  assert.equal(writeThreads(ordered, true, storage).saved, true);
  const exported = JSON.parse(storage.getItem(CHAT_STORAGE_KEY)).threads;
  assert.deepEqual(exported[0].contact, contact);
  assert.equal(exported[0].id, first.id);
  assert.deepEqual(readThreads(storage).threads, ordered);
});

test("无联系人旧历史继续兼容；损坏联系人不能静默丢弃后覆盖原历史", () => {
  const original = thread();
  const storage = memoryStorage({ [CHAT_STORAGE_KEY]: currentEnvelope([original]) });
  assert.deepEqual(readThreads(storage).threads, [original]);
  const valid = { id: "lumia", kind: "official", name: "白羽澪", description: "嘴硬照顾 · 主看板" };
  for (const contact of [null, [], { ...valid, kind: "team" }, { ...valid, name: " " }, { ...valid, description: "x".repeat(1001) }, { ...valid, id: "../invalid" }, { ...valid, avatar: "https://remote.test/avatar.png" }, { ...valid, kind: "custom" }, { ...valid, unexpected: true }, { ...valid, tags: "x".repeat(101) }, { ...valid, language: "unsupported" }, { ...valid, avatarColor: "invalid" }]) {
    const raw = currentEnvelope([{ ...original, contact }]);
    const damaged = memoryStorage({ [CHAT_STORAGE_KEY]: raw });
    assert.equal(readThreads(damaged).writable, false);
    assert.equal(writeThreads([{ ...original, contact }], true, storage).saved, false);
    assert.equal(damaged.getItem(CHAT_STORAGE_KEY), raw);
    assert.equal(storage.getItem(CHAT_STORAGE_KEY), currentEnvelope([original]));
  }
});

test("自建联系人历史保存外观ID并重取目录头像，不持久复制的头像路径", () => {
  const contact = { id: "contact-12345678-1234-4123-8123-123456789abc", kind: "custom", name: "自己的同伴", description: "保留自己的角色", appearanceId: "rinne", avatar: "/characters/lumia-avatar.jpg" };
  const original = { ...thread("inherited-appearance"), contact };
  const storage = memoryStorage();
  assert.equal(writeThreads([original], true, storage).saved, true);
  const saved = JSON.parse(storage.getItem(CHAT_STORAGE_KEY)).threads[0];
  assert.equal(saved.id, original.id);
  assert.equal(saved.contact.appearanceId, "rinne");
  assert.equal(Object.hasOwn(saved.contact, "avatar"), false);
  const restored = readThreads(storage).threads[0];
  assert.equal(restored.id, original.id);
  assert.deepEqual(restored.messages, original.messages);
  assert.deepEqual(restored.contact, { ...contact, avatar: "/characters/rinne-avatar.webp" });
  const legacy = memoryStorage({ [CHAT_STORAGE_KEY]: currentEnvelope([original]) });
  assert.equal(readThreads(legacy).threads[0].contact.avatar, "/characters/rinne-avatar.webp");
  assert.equal(legacy.writes.length, 0);
});

test("历史中的无效外观阻止覆盖原文，有效但无头像的目录ID仍可往返", () => {
  const contact = { id: "contact-12345678-1234-4123-8123-123456789abc", kind: "custom", name: "自己的同伴", description: "", appearanceId: "iori" };
  const valid = { ...thread("appearance"), contact };
  const storage = memoryStorage();
  assert.equal(writeThreads([valid], true, storage).saved, true);
  assert.deepEqual(readThreads(storage).threads[0], valid);
  const before = storage.getItem(CHAT_STORAGE_KEY);
  for (const appearanceId of ["unknown", "https://remote.test/avatar", "../iori", null]) {
    const invalid = { ...valid, contact: { ...contact, appearanceId } };
    assert.equal(writeThreads([invalid], true, storage).saved, false);
    assert.equal(storage.getItem(CHAT_STORAGE_KEY), before);
    const raw = currentEnvelope([invalid]);
    const corrupted = memoryStorage({ [CHAT_STORAGE_KEY]: raw });
    assert.equal(readThreads(corrupted).writable, false);
    assert.equal(corrupted.getItem(CHAT_STORAGE_KEY), raw);
  }
});

test("导入头像随同一联系人历史往返，仅保存一份图片字段且保留人物外观", () => {
  const avatarDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
  const contact = { id: "contact-12345678-1234-4123-8123-123456789abc", kind: "custom", name: "头像联系人", description: "", appearanceId: "lumia", avatarDataUrl, avatar: avatarDataUrl };
  const original = { ...thread("imported-picture"), contact };
  const storage = memoryStorage();
  assert.equal(writeThreads([original], true, storage).saved, true);
  const saved = JSON.parse(storage.getItem(CHAT_STORAGE_KEY)).threads[0];
  assert.equal(saved.contact.avatarDataUrl, avatarDataUrl);
  assert.equal(Object.hasOwn(saved.contact, "avatar"), false);
  assert.deepEqual(readThreads(storage).threads, [original]);
  const raw = storage.getItem(CHAT_STORAGE_KEY);
  for (const avatarDataUrl of ["https://remote.test/photo.png", "data:image/svg+xml;base64,PHN2Zy8+", "data:image/png;base64,aW52YWxpZA=="]) {
    const invalid = { ...original, contact: { ...contact, avatarDataUrl } };
    assert.equal(writeThreads([invalid], true, storage).saved, false);
    assert.equal(storage.getItem(CHAT_STORAGE_KEY), raw);
    assert.equal(readThreads(memoryStorage({ [CHAT_STORAGE_KEY]: currentEnvelope([invalid]) })).writable, false);
  }
});
