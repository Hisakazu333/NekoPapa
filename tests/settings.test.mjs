import test from "node:test";
import assert from "node:assert/strict";
import { settingsModule, settingsPreferencesModule } from "./helpers/production.mjs";
import { WorkspaceStore, workspace, sampleState, storage, assertConsistent } from "./helpers/workspace.mjs";

const { SettingsNavigation, searchSettings } = settingsModule;
const { applySettingsPreference: apply } = settingsPreferencesModule;
const contentState = (store) => structuredClone({ items: store.state.items, groups: store.state.groups, archives: store.state.archives, trash: store.state.trash, activeId: store.state.activeId, tabs: store.state.tabs, recent: store.state.recent, history: store.history, navigationMode: store.state.navigationMode });

test("设置分类与内容标签、侧栏分类和内容历史独立，退出后原记录不变", () => {
  const store = workspace();
  store.open("today");
  store.navigate("projects");
  const before = contentState(store);
  const settings = new SettingsNavigation();
  settings.enter();
  for (const section of ["characters", "archive", "trash", "shortcuts"]) assert.equal(settings.select(section), true);
  settings.travel(-1);
  settings.close();
  assert.deepEqual(contentState(store), before);
  assertConsistent(store);
});

test("设置有独立的返回、前进和分叉历史，不接受未知分类", () => {
  const settings = new SettingsNavigation();
  assert.equal(settings.select("archive"), false);
  settings.enter("archive");
  assert.equal(settings.canBack, false);
  settings.select("trash");
  settings.select("general");
  settings.query = "临时查询";
  assert.equal(settings.travel(-1), true);
  assert.equal(settings.section, "trash");
  assert.equal(settings.query, "");
  assert.equal(settings.travel(1), true);
  assert.equal(settings.section, "general");
  settings.travel(-1);
  assert.equal(settings.select("characters"), true);
  assert.equal(settings.canForward, false);
  assert.equal(settings.select("unknown"), false);
  settings.query = "角色";
  settings.close();
  settings.enter("shortcuts");
  assert.equal(settings.query, "");
  assert.equal(settings.section, "shortcuts");
  assert.equal(settings.canBack, false);
});

test("设置搜索按分类与选项匹配，多词查询和无结果保留明确边界", () => {
  assert.deepEqual(searchSettings("  侧栏 宽度 ").map((entry) => entry.id), ["general"]);
  assert.deepEqual(searchSettings("回收站").map((entry) => entry.id), ["trash"]);
  assert.deepEqual(searchSettings("凛音").map((entry) => entry.id), ["characters"]);
  assert.deepEqual(searchSettings("不可能存在的选项"), []);
  assert.equal(searchSettings("").length, 28);
  assert.deepEqual(searchSettings("云点 配额").map((entry) => entry.id), ["usage", "account"]);
  assert.deepEqual(searchSettings("自定义 API").map((entry) => entry.id), ["usage", "models"]);
});

test("设置复用持久化偏好，宽度、隐藏、数量、范围和人物重载后保持", () => {
  const saved = storage(sampleState());
  const store = new WorkspaceStore(saved);
  store.open("today");
  const before = contentState(store);
  for (const [name, value] of [["sidebar-width", "196"], ["sidebar-visible", false], ["list-limit", "20"], ["conversation-scope", "selected"], ["companion", "rinne"]]) assert.equal(apply(store, name, value), true);
  assert.deepEqual(contentState(store), before);
  const restored = new WorkspaceStore(saved);
  assert.equal(restored.state.sidebarWidth, 196);
  assert.equal(restored.state.sidebarVisible, false);
  assert.deepEqual(restored.state.sidebarPreferences, { listLimit: 20, conversationScope: "selected" });
  assert.equal(restored.state.selectedCompanionId, "rinne");
  assert.equal(restored.item("today").companionId, "lumia");
  assertConsistent(restored);
});

test("无效或重复设置不会写入，未知角色与布局值不改变用户数据", () => {
  const saved = storage(sampleState());
  let writes = 0;
  const store = new WorkspaceStore({ getItem: saved.getItem, setItem: (key, value) => { writes++; saved.setItem(key, value); } });
  const before = structuredClone(store.state);
  for (const [name, value] of [["sidebar-width", "195"], ["sidebar-width", "321"], ["sidebar-width", "NaN"], ["sidebar-width", "232"], ["sidebar-width", ""], ["sidebar-width", false], ["list-limit", "7"], ["list-limit", "10"], ["list-limit", " "], ["list-limit", false], ["conversation-scope", "unknown"], ["companion", "missing"], ["feature:missing", true], ["unknown", true]]) assert.equal(apply(store, name, value), false);
  assert.equal(writes, 0);
  assert.deepEqual(store.state, before);
});

test("设置中的固定入口沿用四项上限，可取消，重载不恢复已取消项", () => {
  const saved = storage(sampleState());
  const store = new WorkspaceStore(saved);
  const before = contentState(store);
  assert.equal(apply(store, "feature:characters", true), true);
  assert.equal(store.state.pinnedFeatures.length, 4);
  assert.equal(apply(store, "feature:schedules", true), false);
  assert.equal(apply(store, "feature:characters", false), true);
  assert.equal(apply(store, "feature:schedules", true), true);
  assert.deepEqual(contentState(store), before);
  const restored = new WorkspaceStore(saved);
  assert.equal(restored.state.pinnedFeatures.includes("characters"), false);
  assert.equal(restored.state.pinnedFeatures.includes("schedules"), true);
});

test("恢复导航顺序与宽度只恢复指定偏好，不重置会话、列表或人物", () => {
  const store = workspace();
  store.reorderRail("projects", "home");
  apply(store, "sidebar-width", "320");
  apply(store, "companion", "shiori");
  apply(store, "list-limit", "5");
  const before = contentState(store);
  assert.equal(apply(store, "reset-order", ""), true);
  assert.equal(apply(store, "sidebar-width", "232"), true);
  assert.deepEqual(contentState(store), before);
  assert.equal(store.state.selectedCompanionId, "shiori");
  assert.equal(store.state.sidebarPreferences.listLimit, 5);
  assert.equal(apply(store, "reset-order", ""), false);
});

test("设置保存失败可检测且保留本轮偏好，重试成功后原内容和更改一起恢复", () => {
  const saved = storage(sampleState());
  let blocked = true;
  const store = new WorkspaceStore({ getItem: saved.getItem, setItem: (key, value) => { if (blocked) throw new Error("full"); saved.setItem(key, value); } });
  const before = contentState(store);
  assert.equal(apply(store, "sidebar-width", "280"), true);
  assert.equal(store.storageAvailable, false);
  assert.equal(store.state.sidebarWidth, 280);
  assert.equal(new WorkspaceStore(saved).state.sidebarWidth, 232);
  blocked = false;
  store.persist();
  assert.equal(store.storageAvailable, true);
  assert.equal(new WorkspaceStore(saved).state.sidebarWidth, 280);
  assert.deepEqual(contentState(store), before);
});
