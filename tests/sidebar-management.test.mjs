import test from "node:test";
import assert from "node:assert/strict";
import { sidebarModule, sidebarQueryModule } from "./helpers/production.mjs";
import { WorkspaceStore, workspace, sampleState, storage, assertConsistent } from "./helpers/workspace.mjs";

const { conversationSections } = sidebarModule;
const { sidebarSlice } = sidebarQueryModule;
const conversations = (store) => conversationSections(store.state).flatMap((section) => section.entries.map((entry) => entry.item.id));

test("人物筛选只改变对话索引，不改当前内容、标签、人物归属或历史", () => {
  const seed = sampleState();
  seed.items.find((item) => item.id === "night").companionId = "rinne";
  const store = workspace(seed);
  store.open("night");
  const before = structuredClone({ items: store.state.items, tabs: store.state.tabs, recent: store.state.recent, history: store.history });
  assert.equal(store.setSidebarPreferences({ conversationScope: "selected" }), true);
  assert.deepEqual(conversations(store), ["today"]);
  assert.equal(store.state.activeId, "night");
  assert.equal(store.state.selectedCompanionId, "lumia");
  assert.deepEqual({ items: store.state.items, tabs: store.state.tabs, recent: store.state.recent, history: store.history }, before);
  assertConsistent(store);
});

test("选中人物过滤跟随人物偏好，全部模式包含所有角色且排除 Coding 与页面", () => {
  const seed = sampleState();
  seed.items.find((item) => item.id === "night").companionId = "rinne";
  const store = workspace(seed);
  store.setSidebarPreferences({ conversationScope: "selected" });
  store.selectCompanion("rinne");
  assert.deepEqual(conversations(store), ["night"]);
  store.selectCompanion("iori");
  assert.deepEqual(conversations(store), []);
  store.setSidebarPreferences({ conversationScope: "all" });
  assert.deepEqual(new Set(conversations(store)), new Set(["night", "today"]));
});

test("归档会话不出现在人物筛选中，恢复后仍以同一 ID 与人物归属出现", () => {
  const store = workspace();
  store.setSidebarPreferences({ conversationScope: "selected" });
  const archived = store.archiveItem("today");
  assert.ok(archived);
  assert.deepEqual(conversations(store), ["night"]);
  store.restoreArchive(archived);
  assert.ok(conversations(store).includes("today"));
  assert.equal(store.item("today").companionId, "lumia");
  assertConsistent(store);
});

test("列表设置持久化；旧版本没有设置时使用默认值且保留内容", () => {
  const old = sampleState();
  delete old.sidebarPreferences;
  const persistence = storage(old);
  const store = new WorkspaceStore(persistence);
  assert.deepEqual(store.state.sidebarPreferences, { conversationScope: "all", listLimit: 10 });
  store.setSidebarPreferences({ conversationScope: "selected", listLimit: 5 });
  const reloaded = new WorkspaceStore(persistence);
  assert.deepEqual(reloaded.state.sidebarPreferences, { conversationScope: "selected", listLimit: 5 });
  assert.deepEqual(reloaded.state.items.map((item) => item.id), old.items.map((item) => item.id));
});

test("损坏设置逐字段回退；无效更新和重复更新不写入存储", () => {
  const seed = sampleState();
  seed.sidebarPreferences = { conversationScope: "selected", listLimit: -1 };
  const persistence = storage(seed);
  let writes = 0;
  const store = new WorkspaceStore({ getItem: persistence.getItem, setItem: (key, value) => { writes++; persistence.setItem(key, value); } });
  assert.deepEqual(store.state.sidebarPreferences, { conversationScope: "selected", listLimit: 10 });
  assert.equal(store.setSidebarPreferences({ listLimit: 10 }), false);
  assert.equal(store.setSidebarPreferences({ conversationScope: "unknown", listLimit: 7 }), false);
  assert.equal(writes, 0);
  assert.equal(store.setSidebarPreferences({ listLimit: 0 }), true);
  assert.equal(writes, 1);
  assert.equal(store.state.sidebarPreferences.conversationScope, "selected");
});

test("显示数量设置写入失败时保留本轮操作并报告无法保存", () => {
  const store = new WorkspaceStore({ getItem: () => null, setItem: () => { throw new Error("disk full"); } });
  assert.equal(store.setSidebarPreferences({ listLimit: 20 }), true);
  assert.equal(store.state.sidebarPreferences.listLimit, 20);
  assert.equal(store.storageAvailable, false);
});

test("有界列表保留顺序和当前条目，展开全部后可以还原且不修改源数据", () => {
  const items = Array.from({ length: 13 }, (_, index) => Object.freeze({ id: `item-${index}` }));
  Object.freeze(items);
  const readId = (item) => item.id;
  const limited = sidebarSlice(items, 5, false, "item-11", readId);
  assert.deepEqual(limited.visible.map(readId), ["item-0", "item-1", "item-2", "item-3", "item-11"]);
  assert.equal(limited.remaining, 8);
  assert.deepEqual(sidebarSlice(items, 5, true, "item-11", readId), { visible: items, remaining: 0 });
  assert.deepEqual(sidebarSlice(items, 5, false, "item-11", readId), limited);
  assert.deepEqual(sidebarSlice(items, 0, false, "item-11", readId), { visible: items, remaining: 0 });
});

test("空列表、边界数量与不在该组的当前条目不会产生虚假剩余数量", () => {
  const items = Array.from({ length: 5 }, (_, index) => ({ id: String(index) }));
  assert.deepEqual(sidebarSlice([], 5, false, "0", (item) => item.id), { visible: [], remaining: 0 });
  assert.deepEqual(sidebarSlice(items, 5, false, "elsewhere", (item) => item.id), { visible: items, remaining: 0 });
  const longer = [...items, { id: "5" }];
  assert.deepEqual(sidebarSlice(longer, 5, false, "elsewhere", (item) => item.id), { visible: items, remaining: 1 });
});

test("定位到真实父组会展开正确分类，保留正在查看的内容、历史和人物偏好", () => {
  const store = workspace();
  store.open("today");
  store.selectCompanion("rinne");
  store.state.sidebarVisible = false;
  store.state.activityVisible = true;
  store.state.expanded = [];
  store.state.collapsedSections = ["projects-groups", "library-pages"];
  const before = structuredClone({ tabs: store.state.tabs, items: store.state.items, recent: store.state.recent, history: store.history });
  assert.equal(store.locateItem("project-session"), true);
  assert.equal(store.state.navigationMode, "projects");
  assert.equal(store.state.activeId, "today");
  assert.equal(store.state.sidebarVisible, true);
  assert.equal(store.state.activityVisible, false);
  assert.ok(store.state.expanded.includes("project-neko"));
  assert.equal(store.state.collapsedSections.includes("projects-groups"), false);
  assert.equal(store.state.selectedCompanionId, "rinne");
  assert.deepEqual({ tabs: store.state.tabs, items: store.state.items, recent: store.state.recent, history: store.history }, before);
  assertConsistent(store);
});

test("定位遵循移动后的父组；不存在或已归档的条目保持导航不变", () => {
  const store = workspace();
  store.move("today", "project-neko");
  assert.equal(store.locateItem("today"), true);
  assert.equal(store.state.navigationMode, "projects");
  assert.equal(store.state.groupContext.projects, "project-neko");
  store.archiveItem("today");
  const before = structuredClone(store.state);
  for (const id of ["today", "unknown", "home", "lumia", "group:daily"]) assert.equal(store.locateItem(id), false);
  assert.deepEqual(store.state, before);
  assertConsistent(store);
});
