import test from "node:test";
import assert from "node:assert/strict";
import { tabModule } from "./helpers/production.mjs";
import { workspace, sampleState, storage, WorkspaceStore, assertConsistent } from "./helpers/workspace.mjs";

const { openedTabEntries } = tabModule;
const ids = (entries) => entries.map((entry) => entry.item.id);

test("标签查找只列实际打开的对象，保持用户标签顺序和当前项", () => {
  const store = workspace();
  store.open("weekend");
  const before = structuredClone(store.state);
  const entries = openedTabEntries(store.state);
  assert.deepEqual(ids(entries), ["home", "today", "weekend"]);
  assert.deepEqual(entries.filter((entry) => entry.active).map((entry) => entry.item.id), ["weekend"]);
  assert.equal(entries.some((entry) => entry.item.id === "night"), false);
  assert.deepEqual(store.state, before);
});

test("标签可以按名称、父组、人物和类型查找，多个关键词同时匹配", () => {
  const seed = sampleState();
  seed.items.find((item) => item.id === "night").companionId = "rinne";
  const store = workspace(seed);
  store.open("night");
  store.open("project-session");
  assert.deepEqual(ids(openedTabEntries(store.state, "  睡前  凛音 ")), ["night"]);
  assert.deepEqual(new Set(ids(openedTabEntries(store.state, "日常陪伴"))), new Set(["today", "night"]));
  assert.deepEqual(ids(openedTabEntries(store.state, "白羽澪")), ["today"]);
  assert.deepEqual(ids(openedTabEntries(store.state, "coding")), ["project-session"]);
  assert.deepEqual(ids(openedTabEntries(store.state, "周末 页面")), ["weekend"]);
  assert.deepEqual(openedTabEntries(store.state, "not found"), []);
});

test("查找会即时反映改名和移动，不保留旧位置的标签副本", () => {
  const store = workspace();
  store.rename("today", "今晚散步");
  store.move("today", "ideas");
  assert.deepEqual(ids(openedTabEntries(store.state, "今晚 工作与灵感")), ["today"]);
  assert.equal(openedTabEntries(store.state, "日常陪伴").length, 0);
  assert.equal(openedTabEntries(store.state).filter((entry) => entry.item.id === "today").length, 1);
});

test("从查找结果关闭后台标签只关闭视图，保留内容、活动和当前会话，可恢复", () => {
  const store = workspace();
  store.open("today");
  const content = structuredClone(store.state.items);
  const target = openedTabEntries(store.state, "周末")[0];
  assert.equal(store.close(target.item.id), true);
  assert.deepEqual(openedTabEntries(store.state, "周末"), []);
  assert.equal(store.state.activeId, "today");
  assert.deepEqual(store.state.items, content);
  assert.deepEqual(store.state.archives, []);
  assert.ok(store.restoreClosed());
  assert.deepEqual(ids(openedTabEntries(store.state, "周末")), ["weekend"]);
  assertConsistent(store);
});

test("关闭最后一条内容标签回到首页，唯一首页不可关闭", () => {
  const store = workspace();
  store.closeMany(["home", "weekend"]);
  assert.equal(store.state.tabs.length, 1);
  assert.equal(openedTabEntries(store.state)[0].closeable, true);
  store.close("today");
  assert.deepEqual(ids(openedTabEntries(store.state)), ["home"]);
  assert.equal(openedTabEntries(store.state)[0].closeable, false);
  assert.equal(store.close("home"), false);
  assertConsistent(store);
});

test("标签查找没有固定数量截断，重载保持实际标签与显示数量设置独立", () => {
  const seed = sampleState();
  const more = Array.from({ length: 30 }, (_, index) => ({ id: `page-${index}`, title: `计划 ${index}`, kind: "page", groupId: "ideas" }));
  seed.items.push(...more);
  seed.tabs.push(...more.map((item) => item.id));
  const persistence = storage(seed);
  const store = new WorkspaceStore(persistence);
  store.setSidebarPreferences({ listLimit: 5 });
  const reloaded = new WorkspaceStore(persistence);
  assert.equal(openedTabEntries(reloaded.state, "计划").length, 31);
  assert.deepEqual(ids(openedTabEntries(reloaded.state)), store.state.tabs);
  assertConsistent(reloaded);
});
