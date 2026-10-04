import assert from "node:assert/strict";
import test from "node:test";
import { stateModule, activityModule } from "./helpers/production.mjs";
const { WorkspaceStore, sidebarCreationKind } = stateModule;
const { activitySections, unreadSessionCount } = activityModule;

function storage(seed) {
  const values = new Map(seed ? [["nekopapa.workspace-shell.v1", JSON.stringify(seed)]] : []);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function seed() {
  return {
    ...new WorkspaceStore(storage()).state,
    groups: [{ id: "daily", title: "日常陪伴", kind: "space" }, { id: "project", title: "NekoPapa", kind: "project" }],
    items: [
      { id: "chat-session", title: "今天的陪伴", kind: "conversation", groupId: "daily" },
      { id: "coding", title: "桌面端开发", kind: "coding", groupId: "project" },
      { id: "page", title: "周末计划", kind: "page", groupId: "daily" },
    ],
  };
}
function workspace(data = seed()) { return new WorkspaceStore(storage(data)); }
function ids(store, section) { return activitySections(store.state).filter((entry) => !section || entry.id === section).flatMap((entry) => entry.entries.map(({ item }) => item.id)); }

test("activity is a reversible sidebar view, without adding tabs or altering folder expansion", () => {
  const store = workspace();
  store.navigate("library");
  store.open("page");
  store.toggleGroup("daily");
  store.state.sidebarVisible = false;
  const tabs = [...store.state.tabs], history = [...store.history], expanded = [...store.state.expanded];
  store.toggleActivity();
  assert.equal(store.state.sidebarVisible, true);
  assert.equal(store.state.activityVisible, true);
  assert.equal(store.state.navigationMode, "library");
  assert.equal(store.state.activeId, "page");
  store.open("coding");
  store.toggleActivity();
  assert.equal(store.state.activityVisible, false);
  assert.equal(store.state.navigationMode, "library");
  assert.deepEqual(store.state.expanded, expanded);
  assert.deepEqual(store.state.tabs, [...tabs, "coding"]);
  assert.deepEqual(store.history, [...history, "coding"]);
});

test("explicit category navigation and group location leave activity, without replacing content", () => {
  const store = workspace();
  store.open("coding");
  store.toggleActivity();
  store.navigate("chat");
  assert.equal(store.state.activityVisible, false);
  assert.equal(store.state.activeId, "coding");
  store.toggleActivity();
  store.locateGroup("daily");
  assert.equal(store.state.activityVisible, false);
  assert.equal(store.state.activeId, "coding");
});

test("opening activity while the sidebar is hidden reveals activity instead of silently dismissing it", () => {
  const store = workspace();
  store.toggleActivity();
  store.state.sidebarVisible = false;
  store.toggleActivity();
  assert.equal(store.state.sidebarVisible, true);
  assert.equal(store.state.activityVisible, true);
  assert.deepEqual(store.state.tabs, ["home"]);
});

test("legacy sessions survive activity migration without invented dates, previews or unread badges", () => {
  const data = seed();
  delete data.activityVisible;
  delete data.activityFilter;
  const store = workspace(data);
  assert.equal(store.state.items.length, 3);
  assert.equal(store.state.activityVisible, false);
  assert.equal(store.state.activityFilter, "all");
  assert.equal(unreadSessionCount(store.state), 0);
  assert.deepEqual(new Set(ids(store, "activity-history")), new Set(["chat-session", "coding"]));
  assert.equal(store.item("chat-session").activity.updatedAt, undefined);
  assert.equal(store.item("coding").activity.summary, undefined);
  assert.equal(store.item("page").activity, undefined);
});

test("activity includes every real session, excludes pages, and never duplicates priority entries", () => {
  const data = seed();
  for (let i = 0; i < 24; i++) data.items.push({ id: `session-${i}`, title: `会话 ${i}`, kind: "conversation", groupId: "daily" });
  const store = workspace(data);
  store.pinSession("chat-session");
  store.markSessionRead("coding", false);
  const all = ids(store);
  assert.equal(all.length, 26);
  assert.equal(new Set(all).size, 26);
  assert.ok(!all.includes("page"));
  assert.deepEqual(ids(store, "activity-priority"), ["chat-session", "coding"]);
  assert.deepEqual(store.state.favorites, []);
});

test("actual updates determine chronological buckets; opening, pinning and renaming cannot invent activity", () => {
  const now = new Date(2026, 9, 4, 12);
  const data = seed();
  const updates = [["today", 4], ["yesterday", 3], ["week", 1], ["earlier", 20]];
  data.items = updates.map(([id, day]) => ({ id, title: id, kind: "conversation", groupId: "daily", activity: { status: "completed", unread: false, pinned: false, updatedAt: new Date(2026, day === 20 ? 8 : 9, day, 9).toISOString() } }));
  const store = workspace(data);
  const sections = activitySections(store.state, now);
  assert.equal(sections.find((entry) => entry.id === "activity-today").entries[0].item.id, "today");
  assert.equal(sections.find((entry) => entry.id === "activity-yesterday").entries[0].item.id, "yesterday");
  assert.equal(sections.find((entry) => entry.id === "activity-week").entries[0].item.id, "week");
  assert.equal(sections.find((entry) => entry.id === "activity-earlier").entries[0].item.id, "earlier");
  const timestamp = store.item("earlier").activity.updatedAt;
  store.open("earlier");
  store.rename("earlier", "重命名");
  store.pinSession("earlier");
  store.markSessionRead("earlier", false);
  assert.equal(store.item("earlier").activity.updatedAt, timestamp);
});

test("live session events preserve navigation, set unread correctly and reject late or duplicate updates", () => {
  const store = workspace();
  const tabs = [...store.state.tabs];
  store.pinSession("coding");
  assert.equal(store.recordSessionActivity("coding", { status: "running", updatedAt: "2026-10-04T02:00:00Z", summary: "正在处理侧栏交互" }), true);
  assert.equal(store.item("coding").activity.unread, true);
  assert.equal(store.item("coding").activity.pinned, true);
  assert.deepEqual(store.state.tabs, tabs);
  assert.equal(store.state.activeId, "home");
  assert.equal(store.recordSessionActivity("coding", { status: "completed", updatedAt: "2026-10-04T02:01:00Z", summary: "完成侧栏交互" }, true), true);
  const activity = { ...store.item("coding").activity };
  assert.equal(store.recordSessionActivity("coding", { status: "running", updatedAt: "2026-10-04T02:00:30Z" }), false);
  assert.equal(store.recordSessionActivity("coding", { status: "completed", updatedAt: "2026-10-04T02:01:00Z", summary: "完成侧栏交互" }), false);
  assert.deepEqual(store.item("coding").activity, activity);
  assert.equal(activity.unread, false);
});

test("opening marks the same session read without finishing its running or waiting status", () => {
  const store = workspace();
  store.recordSessionActivity("coding", { status: "waiting", updatedAt: "2026-10-04T02:00:00Z", summary: "等待确认执行" });
  store.toggleActivity();
  store.open("coding");
  store.open("coding");
  assert.equal(unreadSessionCount(store.state), 0);
  assert.equal(store.item("coding").activity.status, "waiting");
  assert.deepEqual(ids(store, "activity-priority"), ["coding"]);
  assert.equal(store.state.tabs.filter((id) => id === "coding").length, 1);
  assert.equal(store.state.activityVisible, true);
});

test("read filtering and bulk marking operate on sessions, not favorites or recorded activity times", () => {
  const store = workspace();
  store.markSessionRead("chat-session", false);
  store.markSessionRead("coding", false);
  store.pinSession("chat-session");
  store.setActivityFilter("unread");
  assert.equal(ids(store).length, 2);
  store.open("chat-session");
  assert.deepEqual(ids(store), ["coding"]);
  store.markAllSessionsRead();
  assert.deepEqual(ids(store), []);
  assert.equal(store.item("chat-session").activity.pinned, true);
  assert.equal(store.item("chat-session").activity.updatedAt, undefined);
  store.setActivityFilter("all");
  assert.equal(ids(store).length, 2);
});

test("tab closing preserves activity; archiving hides it and restores the same pinned session metadata", () => {
  const store = workspace();
  store.recordSessionActivity("chat-session", { status: "completed", updatedAt: "2026-10-04T02:00:00Z", summary: "今天聊了周末安排" });
  store.pinSession("chat-session");
  store.open("chat-session");
  store.close("chat-session");
  assert.ok(ids(store).includes("chat-session"));
  const before = { ...store.item("chat-session").activity };
  const record = store.archiveItem("chat-session");
  assert.ok(!ids(store).includes("chat-session"));
  assert.equal(store.item("chat-session"), undefined);
  const restored = store.restoreArchive(record);
  assert.equal(restored.itemId, "chat-session");
  assert.deepEqual(store.item("chat-session").activity, before);
  assert.equal(ids(store).filter((id) => id === "chat-session").length, 1);
});

test("finishing an archived run updates its record without resurrecting content or tabs", () => {
  const store = workspace();
  store.recordSessionActivity("coding", { status: "running", updatedAt: "2026-10-04T02:00:00Z" });
  const archive = store.archiveItem("coding");
  assert.equal(store.recordSessionActivity("coding", { status: "completed", updatedAt: "2026-10-04T02:01:00Z", summary: "已完成" }), true);
  assert.equal(store.item("coding"), undefined);
  assert.ok(!store.state.tabs.includes("coding"));
  assert.equal(unreadSessionCount(store.state), 0);
  store.restoreArchive(archive);
  assert.equal(store.item("coding").activity.status, "completed");
  assert.equal(unreadSessionCount(store.state), 1);
});

test("pin, unread state, filters and view survive reload with live group names and session identity", () => {
  const saved = storage(seed());
  const store = new WorkspaceStore(saved);
  store.pinSession("coding");
  store.markSessionRead("coding", false);
  store.rename("project", "新项目名");
  store.setActivityFilter("unread");
  store.toggleActivity();
  const reloaded = new WorkspaceStore(saved);
  assert.equal(reloaded.state.activityVisible, true);
  assert.equal(reloaded.state.activityFilter, "unread");
  const entry = activitySections(reloaded.state)[0].entries[0];
  assert.equal(entry.item.id, "coding");
  assert.equal(entry.source.title, "新项目名");
  assert.equal(entry.item.activity.pinned, true);
});

test("new sessions have actual creation times; contextual activity creation never silently creates a page", () => {
  const store = workspace();
  store.navigate("library");
  assert.equal(sidebarCreationKind(store.state), "page");
  store.toggleActivity();
  assert.equal(sidebarCreationKind(store.state), "conversation");
  const start = Date.now();
  const id = store.addItem("conversation", "新对话", "daily");
  const timestamp = Date.parse(store.item(id).activity.updatedAt);
  assert.ok(timestamp >= start && timestamp <= Date.now());
  assert.equal(store.item(id).activity.unread, false);
  store.navigate("projects");
  store.toggleActivity();
  assert.equal(sidebarCreationKind(store.state), "coding");
});

test("invalid updates or activity controls cannot create sessions from pages, system items or unknown IDs", () => {
  const store = workspace();
  const before = JSON.stringify(store.state);
  assert.equal(store.pinSession("page"), false);
  assert.equal(store.markSessionRead("home", false), false);
  assert.equal(store.recordSessionActivity("missing", { status: "running", updatedAt: "2026-10-04T02:00:00Z" }), false);
  assert.equal(store.recordSessionActivity("chat-session", { status: "running", updatedAt: "invalid" }), false);
  assert.equal(store.recordSessionActivity("chat-session", { status: "invented", updatedAt: "2026-10-04T02:00:00Z" }), false);
  assert.equal(JSON.stringify(store.state), before);
});
