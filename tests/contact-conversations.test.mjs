import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-contact-conversations-"));
let conversations;
let synchronization;
let sessionMemory;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./contact-conversations-tsconfig.json", import.meta.url)), "--outDir", output]);
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
  conversations = await import(pathToFileURL(join(output, "components/application/contacts/contact-conversations.js")));
  synchronization = await import(pathToFileURL(join(output, "components/application/contacts/contact-thread-sync.js")));
  sessionMemory = await import(pathToFileURL(join(output, "components/application/agent-chat/chat-session-memory.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const { findContactThread, resolveContactThread, contactPreviews } = conversations;
const { reconcileContactThread, sameContactThread } = synchronization;
const { ChatSessionMemory, emptyChatSession } = sessionMemory;
const lumia = { id: "lumia", kind: "official", name: "白羽澪", description: "嘴硬照顾 · 主看板" };
const rinne = { id: "rinne", kind: "official", name: "雪代凛音", description: "安静有序 · 说到做到" };
const text = (id, role, value) => ({ id, role, parts: [{ type: "text", text: value }] });
const thread = (id, updatedAt, contact, messages = []) => ({ id, updatedAt, title: id, messages, messageAt: {}, ...(contact ? { contact } : {}) });

test("工作台选择并清除联系人后恢复原ID、正文、时间和未发送草稿", () => {
  const memory = new ChatSessionMemory();
  const workspace = {
    ...emptyChatSession("original-workspace"), title: "自己的工作", updatedAt: 120, input: "继续写自己的计划",
    messages: [text("workspace-message", "user", "工作台原消息")], messageAt: { "workspace-message": 120 },
  };
  memory.remember(workspace, false);
  const contactThread = resolveContactThread([], lumia);
  const contactDraft = { ...memory.openThread(contactThread), input: "只发给澪的草稿" };
  memory.remember(contactDraft, true);
  const restored = memory.restoreWorkspace(() => assert.fail("已有工作台不应分配新ID"));
  assert.deepEqual(restored, workspace);
  assert.notEqual(restored.id, contactThread.id);
  assert.deepEqual(contactThread, resolveContactThread([], lumia));
  assert.equal(memory.openThread(contactThread).input, "只发给澪的草稿");
});

test("工作台切换多位联系人时文本草稿按原thread ID隔离，恢复时采用最新正文", () => {
  const memory = new ChatSessionMemory();
  const workspace = { ...emptyChatSession("workspace"), input: "工作台专用" };
  const first = thread("legacy-lumia-id", 100, lumia);
  const second = resolveContactThread([], rinne);
  memory.remember(workspace, false);
  assert.equal(memory.openThread(first).input, "");
  memory.remember({ ...memory.openThread(first), input: "澪的草稿" }, true);
  assert.equal(memory.openThread(second).input, "");
  memory.remember({ ...memory.openThread(second), input: "凛音的草稿" }, true);
  const latest = { ...first, updatedAt: 300, messages: [text("remote-reply", "assistant", "联系人页的新回复")] };
  assert.deepEqual(memory.openThread(latest), {
    id: first.id, title: latest.title, updatedAt: 300, messages: latest.messages, messageAt: latest.messageAt, input: "澪的草稿",
  });
  assert.equal(memory.openThread(second).input, "凛音的草稿");
  assert.deepEqual(memory.restoreWorkspace(() => "unused"), workspace);
});

test("删除先前工作台后清除联系人会创建独立空会话，不复活已删除ID或联系人的草稿", () => {
  const memory = new ChatSessionMemory();
  memory.remember({ ...emptyChatSession("deleted-workspace"), input: "应删除的草稿" }, false);
  const contactThread = resolveContactThread([], lumia);
  memory.remember({ ...memory.openThread(contactThread), input: "联系人草稿" }, true);
  memory.forget("deleted-workspace");
  assert.deepEqual(memory.restoreWorkspace(() => "fresh-workspace"), emptyChatSession("fresh-workspace"));
  assert.equal(memory.openThread(thread("deleted-workspace", 0)).input, "");
  assert.equal(memory.openThread(contactThread).input, "联系人草稿");
});

test("新建工作台后再选择联系人，返回时恢复新工作台及清空后的联系人草稿", () => {
  const memory = new ChatSessionMemory();
  memory.remember({ ...emptyChatSession("old-workspace"), input: "旧工作" }, false);
  const first = resolveContactThread([], lumia);
  memory.remember({ ...memory.openThread(first), input: "尚未发送" }, true);
  memory.remember({ ...memory.openThread(first), input: "" }, true);
  const next = { ...emptyChatSession("new-workspace"), input: "新的工作草稿" };
  memory.remember(next, false);
  memory.remember(memory.openThread(first), true);
  assert.equal(memory.openThread(first).input, "");
  assert.deepEqual(memory.restoreWorkspace(() => "unused"), next);
});

test("打开联系人恢复其最新会话原ID，按实际更新时间而非数组位置选择", () => {
  const older = thread("lumia-old", 100, lumia, [text("old", "user", "旧消息")]);
  const latest = thread("lumia-latest", 300, lumia, [text("latest", "user", "新消息")]);
  const another = thread("rinne-latest", 500, rinne, [text("other", "user", "凛音消息")]);
  const records = [older, another, latest];
  assert.equal(findContactThread(records, lumia.id), latest);
  assert.equal(findContactThread(records, lumia.id).id, "lumia-latest");
  assert.equal(findContactThread(records, rinne.id), another);
  assert.equal(findContactThread(records, "unknown"), undefined);
});

test("普通工作台会话不混入联系人恢复与最近消息预览", () => {
  const records = [
    thread("workspace", 999, undefined, [text("workspace-text", "user", "不能显示给联系人")]),
    thread("lumia-chat", 100, lumia, [text("lumia-text", "assistant", "联系人自己的回复")]),
  ];
  assert.deepEqual(contactPreviews(records), { lumia: { text: "联系人自己的回复", updatedAt: 100 } });
  assert.equal(findContactThread(records, lumia.id).id, "lumia-chat");
  assert.equal(findContactThread(records, "workspace"), undefined);
});

test("工作台与联系人页为尚无历史的联系人解析出同一新会话ID，已有会话沿用原ID", () => {
  const workspaceSelection = resolveContactThread([], lumia);
  const contactsPageSelection = resolveContactThread([], lumia);
  assert.equal(workspaceSelection.id, contactsPageSelection.id);
  assert.equal(workspaceSelection.id, `contact-thread:${lumia.id}`);
  assert.deepEqual(workspaceSelection.messages, []);

  const saved = thread("legacy-lumia-id", 100, lumia, [text("saved", "user", "已有对话")]);
  assert.equal(resolveContactThread([saved], lumia), saved);
});

test("预览取最后一条非系统文本，忽略空消息与仅推理部分并拼接多个文本部分", () => {
  const messages = [
    text("question", "user", "旧问题"),
    { id: "reply", role: "assistant", parts: [{ type: "text", text: "这一条" }, { type: "reasoning", text: "不展示思考" }, { type: "text", text: "完整回复" }] },
    text("empty", "assistant", ""),
    { id: "thinking", role: "assistant", parts: [{ type: "reasoning", text: "仍然不展示思考" }] },
    text("system", "system", "不展示系统提示"),
  ];
  assert.deepEqual(contactPreviews([thread("chat", 123, lumia, messages)]), { lumia: { text: "这一条完整回复", updatedAt: 123 } });
});

test("用户消息作为预览时标记我，空联系人会话不伪造消息和时间", () => {
  assert.deepEqual(contactPreviews([
    thread("lumia-question", 120, lumia, [text("question", "user", "今天一起学习")]),
    thread("rinne-empty", 0, rinne),
  ]), { lumia: { text: "我：今天一起学习", updatedAt: 120 }, rinne: { text: "", updatedAt: 0 } });
});

test("同一联系人只取最新会话预览，查询不修改或丢弃旧的多个thread", () => {
  const records = [
    thread("lumia-old", 50, lumia, [text("old", "assistant", "旧回复")]),
    thread("lumia-new", 100, lumia, [text("new", "assistant", "新回复")]),
    thread("lumia-middle", 75, lumia, [text("middle", "assistant", "中间回复")]),
  ];
  const before = structuredClone(records);
  assert.deepEqual(contactPreviews(records), { lumia: { text: "新回复", updatedAt: 100 } });
  assert.equal(findContactThread(records, lumia.id).id, "lumia-new");
  assert.deepEqual(records, before);
  assert.deepEqual(records.map((item) => item.id), ["lumia-old", "lumia-new", "lumia-middle"]);
});

test("空闲联系人采用外部同ID新消息及名称，保持原ID并更新预览", () => {
  const base = thread("lumia-chat", 100, lumia, [text("first", "user", "原问题")]);
  const remote = { ...base, title: "外部改名", updatedAt: 200, messages: [...base.messages, text("reply", "assistant", "另一窗口的新回复")] };
  const next = reconcileContactThread(base, base, remote);
  assert.equal(next, remote);
  assert.equal(next.id, base.id);
  assert.deepEqual(contactPreviews([next]), { lumia: { text: "另一窗口的新回复", updatedAt: 200 } });
});

test("本地流停止后与外部新消息合并，两边新增消息与真实时间均不丢失", () => {
  const base = { ...thread("lumia-chat", 100, lumia, [text("first", "user", "原问题")]), messageAt: { first: 100 } };
  const local = { ...base, updatedAt: 300, messages: [...base.messages, text("local-user", "user", "本机新问题"), text("local-partial", "assistant", "停止时保留的部分回复")], messageAt: { ...base.messageAt, "local-user": 300, "local-partial": 310 } };
  const remote = { ...base, updatedAt: 200, messages: [...base.messages, text("remote-user", "user", "外部新问题"), text("remote-reply", "assistant", "外部新回复")], messageAt: { ...base.messageAt, "remote-user": 200, "remote-reply": 210 } };
  const beforeLocal = structuredClone(local);
  const beforeRemote = structuredClone(remote);
  const next = reconcileContactThread(base, local, remote);
  assert.equal(next.id, base.id);
  assert.deepEqual(next.messages.map((message) => message.id), ["first", "remote-user", "remote-reply", "local-user", "local-partial"]);
  assert.deepEqual(next.messageAt, { first: 100, "remote-user": 200, "remote-reply": 210, "local-user": 300, "local-partial": 310 });
  assert.equal(next.updatedAt, 300);
  assert.deepEqual(local, beforeLocal);
  assert.deepEqual(remote, beforeRemote);
  assert.equal(reconcileContactThread(next, next, structuredClone(next)), next);
});

test("联系人页和工作台从同一基线各自追加消息时合并一次并保留双方时间", () => {
  const first = text("first", "user", "共同基线");
  const base = { ...thread("lumia-chat", 100, lumia, [first]), messageAt: { first: 100 } };
  const contactPage = {
    ...base,
    updatedAt: 200,
    messages: [...base.messages, text("contact-reply", "assistant", "联系人页回复")],
    messageAt: { ...base.messageAt, "contact-reply": 200 },
  };
  const workbench = {
    ...base,
    updatedAt: 300,
    messages: [...base.messages, text("workbench-question", "user", "工作台追加")],
    messageAt: { ...base.messageAt, "workbench-question": 300 },
  };
  const merged = reconcileContactThread(base, workbench, contactPage);
  assert.deepEqual(merged.messages.map((message) => message.id), ["first", "contact-reply", "workbench-question"]);
  assert.equal(new Set(merged.messages.map((message) => message.id)).size, 3);
  assert.deepEqual(merged.messageAt, { first: 100, "contact-reply": 200, "workbench-question": 300 });
  assert.equal(merged.updatedAt, 300);
  assert.equal(merged.id, base.id);
});

test("重试替换旧回复时不复活未变的旧回复，同时保留外部新增消息", () => {
  const question = text("question", "user", "问题");
  const failed = text("failed", "assistant", "旧的失败片段");
  const base = thread("lumia-chat", 100, lumia, [question, failed]);
  const local = { ...base, updatedAt: 300, messages: [question, text("retry", "assistant", "本机重试结果")] };
  const remote = { ...base, updatedAt: 200, messages: [...base.messages, text("remote", "user", "外部追加")] };
  const next = reconcileContactThread(base, local, remote);
  assert.deepEqual(next.messages.map((message) => message.id), ["question", "remote", "retry"]);
  assert.equal(new Set(next.messages.map((message) => message.id)).size, 3);
});

test("同一消息外部更新不会被未改变的本机版本回退，其他联系人不能合并", () => {
  const base = thread("lumia-chat", 100, lumia, [text("reply", "assistant", "原内容")]);
  const local = { ...base, messages: [...base.messages, text("local", "user", "本机追加")], updatedAt: 300 };
  const remote = { ...base, messages: [text("reply", "assistant", "外部修正内容")], updatedAt: 200 };
  assert.equal(reconcileContactThread(base, local, remote).messages[0].parts[0].text, "外部修正内容");
  assert.equal(reconcileContactThread(base, local, thread("rinne-chat", 400, rinne)), local);
  assert.equal(reconcileContactThread(base, local), local);
  assert.equal(sameContactThread(base, structuredClone(base)), true);
});

test("保存失败时仍以最后成功记录为基线，不让旧存储回退本机新消息", () => {
  const persisted = thread("lumia-chat", 100, lumia, [text("first", "user", "原问题")]);
  const unsaved = { ...persisted, updatedAt: 300, messages: [...persisted.messages, text("local", "user", "尚未保存的新消息")] };
  assert.equal(reconcileContactThread(persisted, unsaved, persisted), unsaved);
  const remote = { ...persisted, updatedAt: 200, messages: [...persisted.messages, text("remote", "user", "失败期间另一窗口的新消息")] };
  const next = reconcileContactThread(persisted, unsaved, remote);
  assert.deepEqual(next.messages.map((message) => message.id), ["first", "remote", "local"]);
});

test("联系人及消息字段顺序变化不算编辑，重试删除不复活重排过的旧回复", () => {
  const question = text("question", "user", "问题");
  const failed = text("failed", "assistant", "失败片段");
  const base = thread("lumia-chat", 100, lumia, [question, failed]);
  const reordered = {
    messageAt: {}, messages: base.messages.map((message) => ({ parts: message.parts.map((part) => ({ text: part.text, type: part.type })), role: message.role, id: message.id })),
    contact: { description: lumia.description, name: lumia.name, kind: lumia.kind, id: lumia.id },
    updatedAt: 100, title: base.title, id: base.id,
  };
  assert.equal(sameContactThread(base, reordered), true);
  assert.equal(sameContactThread(base, { ...reordered, messages: [...reordered.messages].reverse() }), false);
  assert.equal(sameContactThread(base, { ...reordered, contact: { ...reordered.contact, name: "新名字" } }), false);
  const local = { ...base, updatedAt: 300, messages: [question, text("retry", "assistant", "重试结果")] };
  const remote = { ...reordered, updatedAt: 200, messages: [...reordered.messages, text("external", "user", "另一窗口追加")] };
  assert.deepEqual(reconcileContactThread(base, local, remote).messages.map((message) => message.id), ["question", "external", "retry"]);
});
