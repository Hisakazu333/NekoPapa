import assert from "node:assert/strict";
import test from "node:test";
import { sidebarModule } from "./helpers/production.mjs";
import { WorkspaceStore, storage, workspace, sampleState } from "./helpers/workspace.mjs";
const { workbenchEntries, conversationSections } = sidebarModule;

test("an empty workbench has no synthetic shortcuts and derives no empty folder sections", () => {
  const store = new WorkspaceStore(storage());
  const before = structuredClone(store.state);
  assert.deepEqual(workbenchEntries(store.state), { favorites: [], recent: [] });
  assert.deepEqual(conversationSections(store.state), []);
  assert.ok(!store.state.collapsedSections.includes("home-recent"));
  assert.deepEqual(store.state, before);
});

test("workbench favorites and recent visits resolve the same content once without mixing folder records", () => {
  const store = workspace();
  store.open("project-session");
  store.open("weekend");
  store.open("today");
  store.favorite("today");
  const before = structuredClone(store.state);
  const entries = workbenchEntries(store.state);
  assert.deepEqual(entries.favorites.map((item) => item.id), ["today"]);
  assert.deepEqual(entries.recent.map((item) => item.id).slice(0, 2), ["weekend", "project-session"]);
  assert.equal(entries.favorites[0], store.item("today"));
  assert.equal(entries.recent[0], store.item("weekend"));
  assert.deepEqual(store.state, before);
});

test("ordinary conversation groups exclude Coding and pages and ignore the activity-view unread filter", () => {
  const store = workspace();
  store.state.activityFilter = "unread";
  store.item("today").activity = { status: "idle", unread: false, pinned: false, updatedAt: "2026-10-04T01:00:00Z" };
  store.item("night").activity = { status: "idle", unread: false, pinned: false };
  store.item("project-session").activity = { status: "running", unread: true, pinned: true, updatedAt: "2026-10-04T02:00:00Z" };
  const before = structuredClone(store.state);
  const sections = conversationSections(store.state, new Date("2026-10-04T03:00:00Z"));
  const entries = sections.flatMap((section) => section.entries);
  assert.equal(entries.length, store.state.items.filter((item) => item.kind === "conversation").length);
  assert.ok(entries.every((entry) => entry.item.kind === "conversation"));
  assert.equal(new Set(entries.map((entry) => entry.item.id)).size, entries.length);
  assert.ok(sections.find((section) => section.id === "chat-activity-today").entries.some((entry) => entry.item.id === "today"));
  assert.ok(sections.find((section) => section.id === "chat-activity-history").entries.some((entry) => entry.item.id === "night"));
  assert.equal(entries.find((entry) => entry.item.id === "today").source.id, "daily");
  assert.deepEqual(store.state, before);
});

test("pinning and opening reveal the dated conversation list without changing grouping or identity", () => {
  const store = workspace();
  store.navigate("chat");
  store.state.collapsedSections.push("chat-activity-priority");
  const id = "today";
  const group = store.item(id).groupId;
  assert.equal(store.pinSession(id), true);
  assert.ok(!store.state.collapsedSections.includes("chat-activity-priority"));
  store.state.collapsedSections.push("chat-activity-priority");
  store.open(id);
  assert.ok(!store.state.collapsedSections.includes("chat-activity-priority"));
  assert.equal(store.item(id).groupId, group);
  assert.equal(store.state.navigationMode, "chat");
  assert.equal(conversationSections(store.state)[0].entries.filter((entry) => entry.item.id === id).length, 1);
});

test("explicit folder location from workbench switches to its tree while retaining active content and history", () => {
  const saved = storage(sampleState());
  const store = new WorkspaceStore(saved);
  store.open("today");
  const tabs = [...store.state.tabs];
  const history = [...store.history];
  for (const [id, category] of [["daily", "library"], ["project-neko", "projects"]]) {
    store.navigate("home");
    assert.equal(store.locateGroup(id, true), true);
    assert.equal(store.state.navigationMode, category);
    assert.ok(store.state.expanded.includes(id));
    assert.equal(store.state.activeId, "today");
    assert.deepEqual(store.state.tabs, tabs);
    assert.deepEqual(store.history, history);
  }
  assert.equal(new WorkspaceStore(saved).state.navigationMode, "projects");
});

test("opening workbench content reveals its shortcut section and preserves unrelated collapsed sections", () => {
  const store = workspace();
  store.favorite("today");
  store.state.collapsedSections.push("home-favorites", "home-recent", "library-pages");
  store.open("today");
  assert.ok(!store.state.collapsedSections.includes("home-favorites"));
  assert.ok(store.state.collapsedSections.includes("home-recent"));
  assert.ok(store.state.collapsedSections.includes("library-pages"));
  store.open("weekend");
  assert.ok(!store.state.collapsedSections.includes("home-recent"));
  assert.ok(store.state.collapsedSections.includes("library-pages"));
});
