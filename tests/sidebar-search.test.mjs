import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-sidebar-search-"));
let search;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./sidebar-search-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), "{\"type\":\"module\"}");
  search = await import(pathToFileURL(join(output, "components/application/dashboard/sidebar-search.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const { buildSidebarSearchEntries, filterSidebarSearch, isSidebarQuickSearchShortcut, sidebarQuickSearchShortcut, sidebarSearchOptionId } = search;
const message = (id, role, text) => ({ id, role, parts: [{ type: "text", text }] });
const thread = (id, title, updatedAt, messages, contact) => ({ id, title, updatedAt, messages, messageAt: {}, ...(contact ? { contact } : {}) });

test("侧栏索引从聊天正文、联系人资料和设置目录构建结果", () => {
  const contact = { id: "rinne", kind: "official", name: "雪代凛音", description: "一起复习课程", tags: "学习" };
  const conversation = thread("thread-1", "New chat", 20, [
    message("m1", "user", "请帮我排查 Typescript 构建错误"),
    message("m2", "assistant", "先检查 TypeScript 编译输出"),
  ], contact);
  const entries = buildSidebarSearchEntries({
    navigation: [{ key: "contacts", label: "联系人" }],
    threads: [conversation], contacts: [contact],
    settings: [{ id: "appearance", label: "外观", title: "外观偏好", description: "选择主题模式" }],
  });

  assert.equal(filterSidebarSearch(entries, "TYPESCRIPT")[0].id, "thread:thread-1");
  assert.equal(filterSidebarSearch(entries, "雪代 学习")[0].id, "contact:rinne");
  assert.equal(filterSidebarSearch(entries, "appearance")[0].id, "setting:appearance");
  assert.equal(entries.find((entry) => entry.id === "thread:thread-1").subtitle, "先检查 TypeScript 编译输出");
  assert.equal(entries.find((entry) => entry.id === "thread:thread-1").title, "雪代凛音 · New chat");
});

test("设置支持ID和英文别名检索，联系人聊天可搜但不会混入最近列表", () => {
  const contact = { id: "rinne", kind: "official", name: "雪代凛音", description: "一起复习课程", tags: "学习" };
  const conversation = thread("contact-thread", "学习计划", 40, [message("m1", "user", "Review the course")], contact);
  const workspace = thread("workspace-thread", "Workspace plan", 20, [message("m2", "user", "Build a study plan")]);
  const entries = buildSidebarSearchEntries({
    navigation: [], threads: [conversation, workspace], contacts: [contact],
    settings: [
      { id: "appearance", label: "外观", title: "外观偏好", description: "选择主题模式" },
      { id: "agent", label: "Agent", title: "Agent 默认值", description: "保存默认值" },
    ],
  });

  assert.equal(filterSidebarSearch(entries, "appearance")[0].id, "setting:appearance");
  assert.equal(filterSidebarSearch(entries, "dark mode")[0].id, "setting:appearance");
  assert.equal(filterSidebarSearch(entries, "agent defaults")[0].id, "setting:agent");
  assert.equal(filterSidebarSearch(entries, "Review course")[0].id, "thread:contact-thread");
});

test("快速搜索快捷键按系统区分并忽略输入法、重复按键和浏览器地址栏组合", () => {
  const event = (key, options = {}) => ({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, isComposing: false, repeat: false, ...options });
  assert.equal(sidebarQuickSearchShortcut("MacIntel"), "⌘L");
  assert.equal(sidebarQuickSearchShortcut("Win32"), "Ctrl+K");
  assert.equal(isSidebarQuickSearchShortcut(event("l", { metaKey: true }), "MacIntel"), true);
  assert.equal(isSidebarQuickSearchShortcut(event("k", { metaKey: true }), "MacIntel"), true);
  assert.equal(isSidebarQuickSearchShortcut(event("k", { ctrlKey: true }), "Win32"), true);
  assert.equal(isSidebarQuickSearchShortcut(event("l", { ctrlKey: true }), "Win32"), false);
  assert.equal(isSidebarQuickSearchShortcut(event("k", { ctrlKey: true, isComposing: true }), "Win32"), false);
  assert.equal(isSidebarQuickSearchShortcut(event("k", { ctrlKey: true, repeat: true }), "Win32"), false);
  assert.equal(sidebarSearchOptionId("thread:one"), "sidebar-search-option-thread%3Aone");
});
