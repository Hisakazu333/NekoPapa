import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-groups-"));
let GroupChatStore, parseGroupChats, officialGroupRestriction, key, runGroupTurn, pendingGroupSpeakers, unfinishedGroupTurn, resolveGroupContext, groupSystemPrompt, POST, requestGroupReply;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./group-chat-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  symlinkSync(fileURLToPath(new URL("../node_modules", import.meta.url)), join(output, "node_modules"), "dir");
  function extensions(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const path = join(folder, entry.name);
      if (entry.isDirectory()) extensions(path);
      else if (entry.name.endsWith(".js")) writeFileSync(path, readFileSync(path, "utf8").replace(/(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, p, q, s) => `${p}${q}${s.endsWith(".js") ? s : s + ".js"}${q}`));
    }
  }
  extensions(output);
  ({ GroupChatStore, parseGroupChats, officialGroupRestriction, GROUP_CHATS_STORAGE_KEY: key } = await import(pathToFileURL(join(output, "app/group-chat-store.js"))));
  ({ runGroupTurn, pendingGroupSpeakers, unfinishedGroupTurn } = await import(pathToFileURL(join(output, "components/application/contacts/group-turn.js"))));
  ({ resolveGroupContext, groupSystemPrompt } = await import(pathToFileURL(join(output, "app/api/chat/group-context.js"))));
  ({ POST } = await import(pathToFileURL(join(output, "app/api/chat/route.js"))));
  ({ requestGroupReply } = await import(pathToFileURL(join(output, "components/application/contacts/group-reply.js"))));
} finally { rmSync(output, { recursive: true, force: true }); }

const members = [
  { id: "contact-12345678-1234-4123-8123-123456789ab1", kind: "custom", name: "课程导师", description: "解释概念", prompt: "先解释概念，再给练习。" },
  { id: "contact-12345678-1234-4123-8123-123456789ab2", kind: "custom", name: "编程搭子", description: "分析代码" },
  { id: "contact-12345678-1234-4123-8123-123456789abc", kind: "custom", name: "课程助教", description: "先提示" },
];
const official = { id: "lumia", kind: "official", name: "白羽澪", description: "照顾" };
const importedAvatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
function memory() { const entries = new Map(); return { entries, getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }; }
function opened(storage = memory()) {
  const store = new GroupChatStore(storage);
  const group = store.create(members).group;
  const message = { id: "turn-1", role: "user", text: "解释一下微积分", at: Date.now() };
  store.putMessage(group.id, message);
  return { store, group: store.getSnapshot().groups[0], storage };
}

test("使用导入头像的自建联系人可以建群，重载保留成员ID和单份头像数据", () => {
  const storage = memory();
  const selected = members.map((member) => ({ ...member, avatarDataUrl: importedAvatar, avatar: importedAvatar }));
  const group = new GroupChatStore(storage).create(selected).group;
  assert.ok(group);
  const raw = JSON.parse(storage.entries.get(key)).groups[0];
  assert.ok(raw.members.every((member) => member.avatarDataUrl === importedAvatar && !Object.hasOwn(member, "avatar")));
  const restored = new GroupChatStore(storage); restored.reload();
  assert.equal(restored.getSnapshot().groups[0].id, group.id);
  assert.deepEqual(restored.getSnapshot().groups[0].members, selected);
});

test("群聊创建校验2–5位独立成员，建立稳定ID和独立存储，重载恢复消息及发言人", () => {
  const storage = memory();
  const store = new GroupChatStore(storage);
  for (const selection of [[], members.slice(0, 1), [members[0], members[0]], [...members, ...members]]) assert.ok(store.create(selection).error);
  assert.equal(storage.entries.size, 0);
  const group = store.create(members).group;
  assert.match(group.id, /^group-/);
  assert.deepEqual(group.members.map((member) => member.id), members.map((member) => member.id));
  store.putMessage(group.id, { id: "u1", role: "user", text: "独立群消息", at: 100 });
  store.putMessage(group.id, { id: "a1", role: "assistant", speakerId: members[0].id, turnId: "u1", text: "回复", state: "complete", at: 101 });
  const reloaded = new GroupChatStore(storage); reloaded.reload();
  assert.equal(reloaded.getSnapshot().groups[0].id, group.id);
  assert.equal(reloaded.getSnapshot().groups[0].messages[1].speakerId, members[0].id);
  assert.equal(storage.entries.size, 1);
  assert.ok(storage.entries.has(key));
});

test("官方人物不能建群，旧群历史保持可读并原样保留，自建联系人群聊不受影响", () => {
  const storage = memory();
  const legacy = { id: "group-legacy-official", title: "以前的群聊", members: [official, members[0]], updatedAt: 100, messages: [
    { id: "old-user", role: "user", text: "旧消息", at: 10 },
    { id: "old-reply", role: "assistant", text: "旧回复", at: 11, speakerId: official.id, turnId: "old-user", state: "complete" },
  ] };
  const original = JSON.stringify({ version: 1, groups: [legacy] });
  storage.entries.set(key, original);
  const store = new GroupChatStore(storage); store.reload();
  assert.deepEqual(store.getSnapshot().groups, [legacy]);
  assert.equal(storage.entries.get(key), original);
  assert.match(officialGroupRestriction(legacy.members), /单人陪伴聊天和学习/);
  assert.equal(officialGroupRestriction(members), undefined);
  for (const selection of [[official, members[0]], [{ ...official, kind: "custom" }, members[0]]]) {
    assert.ok(store.create(selection).error);
    assert.equal(storage.entries.get(key), original);
    assert.deepEqual(store.getSnapshot().groups, [legacy]);
  }
  assert.match(store.create([official, members[0]]).error, /不能加入群聊/);
  assert.ok(store.create(members).group);
  assert.deepEqual(parseGroupChats(storage.entries.get(key)).find((group) => group.id === legacy.id), legacy);
});

test("群聊合并最新存储保留其他群和同群外部新消息；写入失败保留消息可原ID重试", () => {
  const { store, group, storage } = opened();
  const other = new GroupChatStore(storage); other.reload();
  const separate = other.create(members.slice(0, 2)).group;
  other.putMessage(group.id, { id: "external", role: "user", text: "另一窗口", at: Date.now() + 1 });
  store.putMessage(group.id, { id: "local", role: "user", text: "本窗口", at: Date.now() + 2 });
  assert.equal(parseGroupChats(storage.entries.get(key)).length, 2);
  assert.ok(parseGroupChats(storage.entries.get(key)).find((item) => item.id === separate.id));
  assert.deepEqual(new Set(parseGroupChats(storage.entries.get(key)).find((item) => item.id === group.id).messages.map((item) => item.id)), new Set(["turn-1", "external", "local"]));
  let fail = true;
  const failing = new GroupChatStore({ getItem: storage.getItem, setItem: (key, value) => { if (fail) throw new Error("quota"); storage.setItem(key, value); } });
  failing.reload();
  const before = storage.entries.get(key);
  assert.equal(failing.putMessage(group.id, { id: "unsaved", role: "user", text: "保留", at: Date.now() + 3 }), false);
  assert.equal(storage.entries.get(key), before);
  assert.ok(failing.getSnapshot().groups.find((item) => item.id === group.id).messages.some((item) => item.id === "unsaved"));
  fail = false; assert.equal(failing.retry(), true);
  assert.equal(parseGroupChats(storage.entries.get(key)).find((item) => item.id === group.id).messages.filter((item) => item.id === "unsaved").length, 1);
});

test("创建提交失败不会留下幽灵群聊或改变已有群聊与原始存储", () => {
  const storage = memory();
  const store = new GroupChatStore(storage);
  const existing = store.create(members.slice(0, 2)).group;
  const before = storage.entries.get(key);
  let reads = 0;
  const failing = new GroupChatStore({
    getItem: (name) => { if (++reads === 2) throw new Error("storage unavailable"); return storage.getItem(name); },
    setItem: () => { throw new Error("storage unavailable"); },
  });
  const result = failing.create(members);
  assert.equal(result.group, undefined);
  assert.match(result.error, /创建/);
  assert.deepEqual(failing.getSnapshot().groups.map((item) => item.id), [existing.id]);
  assert.equal(storage.entries.get(key), before);
  const restored = new GroupChatStore(storage);
  restored.reload();
  assert.equal(restored.getSnapshot().groups[0].id, existing.id);
});

test("损坏和读取失败不覆盖群聊；非法speaker、重复消息和缺失turn拒绝", () => {
  const { group, storage } = opened();
  for (const messages of [[...group.messages, { id: "bad", role: "assistant", speakerId: "intruder", turnId: "turn-1", text: "", at: 2, state: "complete" }], [group.messages[0], group.messages[0]], [{ id: "a", role: "assistant", speakerId: members[0].id, turnId: "missing", text: "", at: 2, state: "complete" }]]) assert.throws(() => parseGroupChats(JSON.stringify({ version: 1, groups: [{ ...group, messages }] })));
  storage.entries.set(key, "{broken");
  const store = new GroupChatStore(storage); store.reload();
  assert.equal(store.getSnapshot().writable, false);
  assert.ok(store.create(members).error);
  assert.equal(storage.entries.get(key), "{broken");
  assert.equal(storage.entries.get(`${key}.recovery`), "{broken");
  const failing = new GroupChatStore({ getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("should not write"); } });
  assert.ok(failing.create(members).error);
  assert.equal(failing.getSnapshot().writable, false);
});

test("只合并本次消息变更，不让旧副本回退外部完成回复；读取突然失败保留新用户消息", () => {
  const { store, group, storage } = opened();
  store.putMessage(group.id, { id: "reply", role: "assistant", speakerId: members[0].id, turnId: "turn-1", text: "部分", state: "streaming", at: Date.now() });
  const outside = new GroupChatStore(storage); outside.reload();
  outside.putMessage(group.id, { id: "reply", role: "assistant", speakerId: members[0].id, turnId: "turn-1", text: "外部完成", state: "complete", at: Date.now() });
  store.putMessage(group.id, { id: "next-user", role: "user", text: "下一条", at: Date.now() + 1 });
  assert.equal(parseGroupChats(storage.entries.get(key))[0].messages.find((message) => message.id === "reply").text, "外部完成");
  let failing = false;
  const intermittent = new GroupChatStore({ getItem: (key) => { if (failing) throw new Error("blocked"); return storage.getItem(key); }, setItem: storage.setItem });
  intermittent.reload(); failing = true;
  assert.equal(intermittent.putMessage(group.id, { id: "preserved", role: "user", text: "读取失败时也保留", at: Date.now() + 2 }), false);
  assert.ok(intermittent.getSnapshot().groups[0].messages.some((message) => message.id === "preserved"));
  assert.equal(intermittent.getSnapshot().writable, false);
  failing = false; assert.equal(intermittent.retry(), true);
  assert.equal(parseGroupChats(storage.entries.get(key))[0].messages.filter((message) => message.id === "preserved").length, 1);
});

test("删除指定群聊及其消息，其他群聊的ID、成员与消息原样保留并在重载恢复", () => {
  const { store, group, storage } = opened();
  const other = store.create(members.slice(0, 2)).group;
  store.putMessage(other.id, { id: "other-message", role: "user", text: "保留这条消息", at: 101 });
  const preserved = structuredClone(store.getSnapshot().groups.find((item) => item.id === other.id));
  assert.equal(store.removeGroup(group.id), true);
  assert.deepEqual(store.getSnapshot().groups, [preserved]);
  const reloaded = new GroupChatStore(storage); reloaded.reload();
  assert.deepEqual(reloaded.getSnapshot().groups, [preserved]);
  assert.equal(reloaded.removeGroup(group.id), true);
  const next = reloaded.create(members).group;
  assert.notEqual(next.id, group.id);
  assert.deepEqual(parseGroupChats(storage.entries.get(key)).find((item) => item.id === other.id), preserved);
  assert.equal(parseGroupChats(storage.entries.get(key)).some((item) => item.id === group.id), false);
});

test("包含官方人物的旧群聊也可删除，不修改其他群聊或官方联系人身份", () => {
  const storage = memory();
  const legacy = { id: "group-old-official", title: "旧官方人物群聊", members: [official, members[0]], messages: [], updatedAt: 10 };
  storage.entries.set(key, JSON.stringify({ version: 1, groups: [legacy] }));
  const store = new GroupChatStore(storage); store.reload();
  const custom = store.create(members).group;
  assert.equal(store.removeGroup(legacy.id), true);
  assert.deepEqual(parseGroupChats(storage.entries.get(key)), [custom]);
  assert.equal(store.create([official, members[0]]).group, undefined);
  assert.equal(official.kind, "official");
});

test("删除不存在的群聊返回失败且不写入、不改变当前消息", () => {
  const { group, storage } = opened();
  let writes = 0;
  const store = new GroupChatStore({ getItem: storage.getItem, setItem: (name, value) => { writes++; storage.setItem(name, value); } });
  store.reload();
  const original = storage.entries.get(key);
  for (const groupId of ["", "group-missing", "not-a-group"]) assert.equal(store.removeGroup(groupId), false);
  assert.equal(writes, 0);
  assert.equal(storage.entries.get(key), original);
  assert.deepEqual(store.getSnapshot().groups, [group]);
});

test("删除写入失败保留原群和原消息，普通保存不暗中删除，显式重试成功", () => {
  const { group, storage } = opened();
  let fail = false;
  const store = new GroupChatStore({ getItem: storage.getItem, setItem: (name, value) => { if (fail) throw new Error("quota"); storage.setItem(name, value); } });
  store.reload();
  const original = storage.entries.get(key);
  fail = true;
  assert.equal(store.removeGroup(group.id), false);
  assert.deepEqual(store.getSnapshot().groups, [group]);
  assert.match(store.getSnapshot().error, /未能删除/);
  assert.equal(storage.entries.get(key), original);
  fail = false;
  assert.equal(store.retry(), true);
  assert.deepEqual(parseGroupChats(storage.entries.get(key)), [group]);
  assert.equal(store.removeGroup(group.id), true);
  assert.deepEqual(parseGroupChats(storage.entries.get(key)), []);
});

test("删除读取失败或遇到损坏数据时保留原记录，存储恢复后可重新删除", () => {
  const { group, storage } = opened();
  let fail = false;
  const store = new GroupChatStore({ getItem: (name) => { if (fail) throw new Error("blocked"); return storage.getItem(name); }, setItem: storage.setItem });
  store.reload();
  const original = storage.entries.get(key);
  fail = true;
  assert.equal(store.removeGroup(group.id), false);
  assert.equal(store.getSnapshot().writable, false);
  assert.deepEqual(store.getSnapshot().groups, [group]);
  assert.equal(storage.entries.get(key), original);
  fail = false;
  storage.entries.set(key, "{broken");
  assert.equal(store.removeGroup(group.id), false);
  assert.equal(storage.entries.get(key), "{broken");
  assert.equal(storage.entries.get(`${key}.recovery`), "{broken");
  assert.deepEqual(store.getSnapshot().groups, [group]);
  storage.entries.set(key, original);
  assert.equal(store.removeGroup(group.id), true);
  assert.deepEqual(store.getSnapshot().groups, []);
});

test("旧窗口的待写消息在重载及重试时不会恢复已删除群聊，其他待写消息保留", () => {
  const { store, group, storage } = opened();
  const other = store.create(members.slice(0, 2)).group;
  let fail = true;
  const stale = new GroupChatStore({ getItem: storage.getItem, setItem: (name, value) => { if (fail) throw new Error("quota"); storage.setItem(name, value); } });
  stale.reload();
  assert.equal(stale.putMessage(group.id, { id: "pending-deleted", role: "user", text: "不应恢复", at: Date.now() + 1 }), false);
  assert.equal(stale.putMessage(other.id, { id: "pending-other", role: "user", text: "需要保留", at: Date.now() + 2 }), false);
  assert.equal(store.removeGroup(group.id), true);
  stale.reload();
  assert.equal(stale.getSnapshot().groups.some((item) => item.id === group.id), false);
  assert.equal(stale.getSnapshot().groups[0].messages[0].id, "pending-other");
  fail = false;
  assert.equal(stale.retry(), true);
  assert.deepEqual(parseGroupChats(storage.entries.get(key)).map((item) => item.id), [other.id]);
  assert.equal(parseGroupChats(storage.entries.get(key))[0].messages[0].id, "pending-other");
});

test("待写消息未经过重载而直接重试也不能恢复已被其他窗口删除的群聊", () => {
  const { store, group, storage } = opened();
  let fail = true;
  const stale = new GroupChatStore({ getItem: storage.getItem, setItem: (name, value) => { if (fail) throw new Error("quota"); storage.setItem(name, value); } });
  stale.reload();
  assert.equal(stale.putMessage(group.id, { id: "pending-before-delete", role: "user", text: "删除前未保存", at: Date.now() }), false);
  assert.equal(store.removeGroup(group.id), true);
  const original = storage.entries.get(key);
  fail = false;
  assert.equal(stale.retry(), true);
  assert.equal(storage.entries.get(key), original);
  assert.deepEqual(stale.getSnapshot().groups, []);
});

test("删除合并其他群聊的新消息及本窗口未保存内容，保留原消息ID", () => {
  const { store, group, storage } = opened();
  const other = store.create(members.slice(0, 2)).group;
  let fail = true;
  const deleting = new GroupChatStore({ getItem: storage.getItem, setItem: (name, value) => { if (fail) throw new Error("quota"); storage.setItem(name, value); } });
  deleting.reload();
  assert.equal(deleting.putMessage(other.id, { id: "pending-kept", role: "user", text: "本机未保存", at: Date.now() + 1 }), false);
  assert.equal(store.putMessage(other.id, { id: "external-kept", role: "user", text: "外部新内容", at: Date.now() + 2 }), true);
  fail = false;
  assert.equal(deleting.removeGroup(group.id), true);
  const remaining = parseGroupChats(storage.entries.get(key));
  assert.deepEqual(remaining.map((item) => item.id), [other.id]);
  assert.deepEqual(remaining[0].messages.map((message) => message.id), ["pending-kept", "external-kept"]);
});

test("没有接到重载事件的旧窗口及迟到的回复无法重新创建被删除群聊", () => {
  const { store, group, storage } = opened();
  const stale = new GroupChatStore(storage); stale.reload();
  assert.equal(store.removeGroup(group.id), true);
  const original = storage.entries.get(key);
  assert.equal(stale.putMessage(group.id, { id: "late-reply", role: "assistant", speakerId: members[0].id, turnId: "turn-1", text: "迟到的回复", state: "complete", at: Date.now() }), false);
  assert.equal(storage.entries.get(key), original);
  assert.deepEqual(stale.getSnapshot().groups, []);
  assert.equal(stale.retry(), true);
  assert.deepEqual(parseGroupChats(storage.entries.get(key)), []);
});

test("损坏的删除记录阻止覆盖，合法删除记录优先于旧窗口残留的群聊副本", () => {
  const { group, storage } = opened();
  for (const deletedIds of [null, "group-bad", ["wrong"], [group.id, group.id]]) {
    const raw = JSON.stringify({ version: 1, groups: [group], deletedIds });
    assert.throws(() => parseGroupChats(raw));
    storage.entries.set(key, raw);
    const store = new GroupChatStore(storage); store.reload();
    assert.equal(store.removeGroup(group.id), false);
    assert.equal(storage.entries.get(key), raw);
  }
  const raw = JSON.stringify({ version: 1, groups: [group], deletedIds: [group.id] });
  assert.deepEqual(parseGroupChats(raw), []);
  storage.entries.set(key, raw);
  const store = new GroupChatStore(storage); store.reload();
  assert.deepEqual(store.getSnapshot().groups, []);
});

test("每轮真实请求按选定顺序执行，后续成员可见前面回复，只标记当前发言者", async () => {
  const { group } = opened(); const emitted = []; const calls = [];
  const result = await runGroupTurn({ group, turnId: "turn-1", signal: new AbortController().signal, onSpeaker: () => {}, onMessage: (message) => emitted.push(message), reply: async ({ contact, group, onText }) => {
    calls.push({ id: contact.id, replies: group.messages.filter((message) => message.role === "assistant").map((message) => message.speakerId) });
    onText(`partial ${contact.name}`); return `reply ${contact.name}`;
  } });
  assert.equal(result, "complete");
  assert.deepEqual(calls.map((call) => call.id), members.map((member) => member.id));
  assert.deepEqual(calls[2].replies, members.slice(0, 2).map((member) => member.id));
  assert.deepEqual(emitted.filter((message) => message.state === "complete").map((message) => message.speakerId), members.map((member) => member.id));
  assert.equal(group.messages.length, 1);
});

test("停止中止后续成员并保留部分回复；继续只重试原turn未完成成员", async () => {
  const { group } = opened(); const controller = new AbortController(); let calls = 0;
  const messages = new Map(group.messages.map((message) => [message.id, message]));
  const first = await runGroupTurn({ group, turnId: "turn-1", signal: controller.signal, onSpeaker: () => {}, onMessage: (message) => messages.set(message.id, message), reply: async ({ onText }) => { calls++; onText("保留部分"); controller.abort(); throw new Error("aborted"); } });
  assert.equal(first, "stopped"); assert.equal(calls, 1);
  const partial = [...messages.values()].find((message) => message.role === "assistant");
  assert.equal(partial.text, "保留部分"); assert.equal(partial.state, "stopped");
  const retried = { ...group, messages: [...messages.values()] };
  const second = await runGroupTurn({ group: retried, turnId: "turn-1", signal: new AbortController().signal, onSpeaker: () => {}, onMessage: (message) => messages.set(message.id, message), reply: async () => "完整" });
  assert.equal(second, "complete");
  assert.equal([...messages.values()].filter((message) => message.role === "assistant").length, 3);
  assert.equal([...messages.values()].find((message) => message.speakerId === members[0].id).id, partial.id);
  assert.equal(pendingGroupSpeakers({ ...group, messages: [...messages.values()] }, "turn-1").length, 0);
});

test("有未完成轮次时先续最早一轮，续聊上下文不包含后续用户消息", async () => {
  const { group } = opened();
  const incomplete = { id: "partial-1", role: "assistant", speakerId: members[0].id, turnId: "turn-1", text: "部分回复", state: "stopped", at: Date.now() };
  const later = { id: "turn-2", role: "user", text: "后续问题", at: Date.now() + 1 };
  const interrupted = { ...group, messages: [...group.messages, incomplete, later] };
  assert.equal(unfinishedGroupTurn(interrupted).id, "turn-1");
  const calls = [];
  const emitted = new Map(interrupted.messages.map((message) => [message.id, message]));
  const result = await runGroupTurn({ group: interrupted, turnId: "turn-1", signal: new AbortController().signal, onSpeaker: () => {}, onMessage: (message) => emitted.set(message.id, message), reply: async ({ contact, group: context }) => {
    calls.push({ id: contact.id, hasLaterQuestion: context.messages.some((message) => message.id === "turn-2") });
    return "已继续";
  } });
  assert.equal(result, "complete");
  assert.deepEqual(calls.map((call) => call.id), members.map((member) => member.id));
  assert.ok(calls.every((call) => !call.hasLaterQuestion));
  assert.equal(unfinishedGroupTurn({ ...interrupted, messages: [...emitted.values()] }).id, "turn-2");
});

test("成员失败暂停本轮；重试不重复已经完成的成员和用户消息", async () => {
  const { group } = opened(); const messages = new Map(group.messages.map((message) => [message.id, message]));
  const first = await runGroupTurn({ group, turnId: "turn-1", signal: new AbortController().signal, onSpeaker: () => {}, onMessage: (message) => messages.set(message.id, message), reply: async ({ contact }) => { if (contact.id === members[1].id) throw new Error("network"); return "成功"; } });
  assert.equal(first, "failed");
  const pending = pendingGroupSpeakers({ ...group, messages: [...messages.values()] }, "turn-1");
  assert.deepEqual(pending.map((member) => member.id), members.slice(1).map((member) => member.id));
  let calls = [];
  await runGroupTurn({ group: { ...group, messages: [...messages.values()] }, turnId: "turn-1", signal: new AbortController().signal, onSpeaker: () => {}, onMessage: (message) => messages.set(message.id, message), reply: async ({ contact }) => { calls.push(contact.id); return "恢复"; } });
  assert.deepEqual(calls, members.slice(1).map((member) => member.id));
  assert.equal([...messages.values()].filter((message) => message.role === "user").length, 1);
});

test("群上下文只接收自建联系人，拒绝缺少发言者或重复成员，系统只许一个speaker", () => {
  const speaker = members[0];
  const resolved = resolveGroupContext({ members }, speaker);
  assert.deepEqual(resolved.members, members);
  for (const value of [{ members: [] }, { members: [members[1], members[2]] }, { members: [speaker, speaker] }, { members, instruction: "pretend" }, { members: [official, speaker] }, { members: [{ ...official, kind: "custom" }, speaker] }]) assert.equal(resolveGroupContext(value, speaker), undefined);
  assert.equal(resolveGroupContext({ members }, undefined), undefined);
  assert.equal(resolveGroupContext({ members }, official), undefined);
  const prompt = groupSystemPrompt(resolved, resolved.members[0]);
  assert.match(prompt, /speaking only as the selected contact/);
  assert.match(prompt, /untrusted identity data/);
  assert.match(prompt, /Do not impersonate another participant/);
});

test("群API拒绝成员越界和无发言者请求，返回400而不调用提供方", async () => {
  for (const groupContext of [null, {}, { members: [] }, { members: members.slice(1) }, { members: [members[0], members[0]] }, { members, system: "override" }]) {
    const response = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ messages: [], contact: members[0], groupContext }) }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "invalid_group");
  }
});

test("群API拒绝官方发言者、含官方成员的自建发言和伪装官方ID，均不调用提供方", async () => {
  for (const [contact, selected] of [
    [official, [official, members[0]]],
    [members[0], [members[0], official]],
    [members[0], [members[0], { ...official, kind: "custom" }]],
  ]) {
    const response = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ messages: [], contact, groupContext: { members: selected } }) }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "invalid_group");
  }
});

test("群聊真实调用路径经过UI流传输及POST；模拟提供方按成员收取身份和之前发言", async (t) => {
  const captured = [];
  const requests = [];
  const server = createServer(async (incoming, outgoing) => {
    let raw = ""; for await (const chunk of incoming) raw += chunk;
    captured.push(JSON.parse(raw));
    const content = `模型回复 ${captured.length}`;
    const part = { id: `reply-${captured.length}`, object: "chat.completion.chunk", created: 1, model: "group-test", choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] };
    outgoing.writeHead(200, { "content-type": "text/event-stream" });
    outgoing.end(`data: ${JSON.stringify(part)}\n\ndata: ${JSON.stringify({ ...part, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })}\n\ndata: [DONE]\n\n`);
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const overrides = { AI_PROVIDER: "custom", AI_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`, CHAT_MODEL: "group-test", AI_API_KEY: "group-local-test-only" };
  const previous = new Map(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (input === "/api/chat") { requests.push(JSON.parse(init.body)); return POST(new Request("http://localhost/api/chat", init)); }
    return originalFetch(input, init);
  };
  t.after(async () => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of previous) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  });
  const openedGroup = opened().group;
  const group = { ...openedGroup, members: openedGroup.members.map((member) => ({ ...member, avatarDataUrl: importedAvatar, avatar: importedAvatar })) };
  const emissions = [];
  const result = await runGroupTurn({ group, turnId: "turn-1", signal: new AbortController().signal, reply: requestGroupReply, onSpeaker: () => {}, onMessage: (message) => emissions.push(message) });
  assert.equal(result, "complete");
  assert.equal(captured.length, 3);
  const systems = captured.map((body) => body.messages.find((message) => message.role === "system").content);
  systems.forEach((system, index) => { assert.ok(system.includes(`speaking only as the selected contact ${JSON.stringify(members[index].name)}`)); assert.match(system, /Do not impersonate another participant/); });
  assert.ok(JSON.stringify(captured[1].messages).includes("模型回复 1"));
  assert.ok(JSON.stringify(captured[1].messages).includes(members[0].name));
  assert.deepEqual(emissions.filter((message) => message.state === "complete").map((message) => message.text), ["模型回复 1", "模型回复 2", "模型回复 3"]);
  assert.equal(requests.length, 3);
  for (const request of requests) assert.deepEqual(request.groupContext.members, members);
  assert.doesNotMatch(JSON.stringify({ requests, captured }), /avatarDataUrl|data:image|iVBORw0KGgo/);
});
