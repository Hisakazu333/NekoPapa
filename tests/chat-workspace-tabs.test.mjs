import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-tabs-"));
let tabs;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./chat-workspace-tabs-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  tabs = await import(pathToFileURL(join(output, "components/application/agent-chat/chat-workspace-tabs.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const opened = (...ids) => ids.reduce((state, id) => tabs.openChatWorkspaceTab(state, id), tabs.emptyChatWorkspaceTabs());

test("opening keeps one tab per chat in opening order and records history", () => {
  const state = tabs.openChatWorkspaceTab(opened("a", "b"), "a");
  assert.deepEqual(state.ids, ["a", "b"]);
  assert.equal(state.activeId, "a");
  assert.deepEqual(state.history, ["a", "b", "a"]);
  assert.equal(tabs.navigateChatWorkspaceTabs(state, "back").activeId, "b");
  assert.equal(tabs.navigateChatWorkspaceTabs(state, "forward"), state);
});

test("closing the active tab moves to its left neighbour, else the right one", () => {
  const state = opened("a", "b", "c");
  assert.equal(tabs.nextChatWorkspaceTabAfterClose(state, "c"), "b");
  const closed = tabs.closeChatWorkspaceTab(state, "c");
  assert.deepEqual(closed.ids, ["a", "b"]);
  assert.equal(closed.activeId, "b");
  const first = tabs.closeChatWorkspaceTab(tabs.activateChatWorkspaceTab(closed, "a"), "a");
  assert.equal(first.activeId, "b");
  assert.deepEqual(tabs.closeChatWorkspaceTab(opened("a"), "a"), tabs.emptyChatWorkspaceTabs());
  // Closing a background tab leaves the active one alone.
  assert.equal(tabs.closeChatWorkspaceTab(state, "a").activeId, "c");
});

test("tab entries use real titles and drop chats that no longer exist", () => {
  const state = opened("saved", "contact", "draft", "deleted", "live");
  const threads = [
    { id: "saved", title: "周末计划", unread: true },
    { id: "contact", title: "", contact: { name: "白羽澪" } },
  ];
  const sessions = { draft: { id: "draft", title: null } };
  const entries = tabs.chatTabEntries(state, { activeId: "live", activeTitle: "新对话", threads, sessionOf: (id) => sessions[id] });
  assert.deepEqual(entries, [
    { id: "saved", title: "周末计划", unread: true },
    { id: "contact", title: "白羽澪", unread: false },
    { id: "draft", title: "新对话", unread: false },
    { id: "live", title: "新对话", unread: false },
  ]);
});

test("the active chat always has a tab, even before the open effect runs", () => {
  const entries = tabs.chatTabEntries(opened("a"), { activeId: "b", activeTitle: "正在写", threads: [{ id: "a", title: "旧对话" }], sessionOf: () => undefined });
  assert.deepEqual(entries.map((entry) => entry.id), ["a", "b"]);
  assert.equal(entries[1].title, "正在写");
  assert.deepEqual(tabs.chatTabEntries(tabs.emptyChatWorkspaceTabs(), { activeId: "", activeTitle: "", threads: [], sessionOf: () => undefined }), []);
});

test("清理标签只留下一个新对话，历史从它重新开始", () => {
  const state = tabs.resetChatWorkspaceTabs("fresh");
  assert.deepEqual(state, { ids: ["fresh"], activeId: "fresh", history: ["fresh"], historyIndex: 0 });
  assert.deepEqual(tabs.navigateChatWorkspaceTabs(state, "back"), state);
  assert.deepEqual(tabs.openChatWorkspaceTab(state, "a").ids, ["fresh", "a"]);
});
