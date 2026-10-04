import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceStore, navigationModes, creationKind, storage, sampleState, workspace, assertConsistent } from "./helpers/workspace.mjs";

test("saved rail order is repaired and persists independently from the current content", () => {
  const seed = sampleState();
  seed.railOrder = ["projects", "projects", "invalid", "chat"];
  seed.navigationMode = "chat";
  seed.activeId = "weekend";
  const disk = storage(seed);
  const store = new WorkspaceStore(disk);
  assert.deepEqual(store.state.railOrder, ["projects", "chat", "home", "library", "tasks", "tools"]);
  assert.equal(store.state.navigationMode, "chat");
  assert.equal(store.reorderRail("tools", "home"), true);
  assert.equal(store.reorderRail("projects"), true);
  assert.deepEqual(store.state.railOrder, ["chat", "tools", "home", "library", "tasks", "projects"]);
  const before = structuredClone(store.state);
  assert.equal(store.reorderRail("invalid", "home"), false);
  assert.equal(store.reorderRail("home", "invalid"), false);
  assert.equal(store.reorderRail("home", "home"), false);
  assert.deepEqual(store.state, before);
  const reloaded = new WorkspaceStore(disk);
  assert.deepEqual(reloaded.state.railOrder, store.state.railOrder);
  assert.equal(reloaded.state.activeId, "weekend");
  assert.equal(reloaded.state.navigationMode, "chat");
  assertConsistent(reloaded);
});

test("dragging tabs before another tab or to the end preserves active content and history", () => {
  const disk = storage(sampleState());
  const store = new WorkspaceStore(disk);
  store.open("weekend");
  store.navigate("chat");
  const history = [...store.history];
  assert.equal(store.reorderTab("weekend", "home"), true);
  assert.deepEqual(store.state.tabs, ["weekend", "home", "today"]);
  assert.equal(store.reorderTab("home"), true);
  assert.deepEqual(store.state.tabs, ["weekend", "today", "home"]);
  assert.equal(store.state.activeId, "weekend");
  assert.equal(store.state.navigationMode, "chat");
  assert.deepEqual(store.history, history);
  const before = structuredClone(store.state);
  assert.equal(store.reorderTab("today", "missing"), false);
  assert.equal(store.reorderTab("missing", "today"), false);
  assert.equal(store.reorderTab("today", "today"), false);
  assert.deepEqual(store.state, before);
  assert.deepEqual(new WorkspaceStore(disk).state.tabs, store.state.tabs);
  assertConsistent(store);
});

test("dragging groups only reorders peers of the same type and leaves other group slots intact", () => {
  const seed = sampleState();
  seed.groups = [seed.groups[0], seed.groups[2], seed.groups[1]];
  const store = workspace(seed);
  assert.equal(store.reorderGroup("ideas", "daily"), true);
  assert.deepEqual(store.state.groups.map((group) => group.id), ["ideas", "project-neko", "daily"]);
  assert.equal(store.reorderGroup("ideas"), true);
  assert.deepEqual(store.state.groups.map((group) => group.id), ["daily", "project-neko", "ideas"]);
  const before = structuredClone(store.state);
  assert.equal(store.reorderGroup("daily", "project-neko"), false);
  assert.equal(store.reorderGroup("missing", "ideas"), false);
  assert.deepEqual(store.state, before);
  assertConsistent(store);
});

test("dragging content reorders within a group or moves across compatible groups atomically", () => {
  const disk = storage(sampleState());
  const store = new WorkspaceStore(disk);
  store.open("weekend");
  store.navigate("library");
  store.favorite("today");
  const tabs = [...store.state.tabs];
  const history = [...store.history];
  assert.equal(store.reorderItem("night", "today", "daily"), true);
  assert.deepEqual(store.state.items.filter((item) => item.groupId === "daily").map((item) => item.id), ["night", "today"]);
  assert.equal(store.reorderItem("today", "inspiration", "ideas"), true);
  assert.equal(store.item("today").groupId, "ideas");
  assert.deepEqual(store.state.items.filter((item) => item.groupId === "ideas").map((item) => item.id), ["weekend", "today", "inspiration"]);
  assert.equal(store.reorderItem("today", undefined, "project-neko"), true);
  assert.deepEqual(store.state.items.filter((item) => item.groupId === "project-neko").map((item) => item.id), ["project-session", "today"]);
  assert.equal(store.state.activeId, "weekend");
  assert.equal(store.state.navigationMode, "library");
  assert.deepEqual(store.state.tabs, tabs);
  assert.deepEqual(store.history, history);
  assert.ok(store.state.favorites.includes("today"));
  const before = structuredClone(store.state);
  assert.equal(store.reorderItem("project-session", undefined, "daily"), false);
  assert.equal(store.reorderItem("weekend", "night", "ideas"), false);
  assert.equal(store.reorderItem("weekend", "missing", "ideas"), false);
  assert.equal(store.reorderItem("weekend", undefined, "missing"), false);
  assert.equal(store.reorderItem("weekend", "weekend", "ideas"), false);
  assert.deepEqual(store.state, before);
  const reloaded = new WorkspaceStore(disk);
  assert.deepEqual(reloaded.state.items, store.state.items);
  assert.equal(reloaded.state.navigationMode, "library");
  assertConsistent(reloaded);
});

test("favorite dragging persists one shared order without changing the underlying folder order", () => {
  const disk = storage(sampleState());
  const store = new WorkspaceStore(disk);
  store.favorite("today"); store.favorite("weekend"); store.favorite("night");
  const items = structuredClone(store.state.items);
  assert.equal(store.reorderFavorite("night", "today"), true);
  assert.deepEqual(store.state.favorites, ["night", "today", "weekend"]);
  assert.equal(store.reorderFavorite("today"), true);
  assert.deepEqual(store.state.favorites, ["night", "weekend", "today"]);
  assert.equal(store.reorderFavorite("inspiration", "night"), false);
  assert.equal(store.reorderFavorite("today", "missing"), false);
  assert.deepEqual(store.state.items, items);
  assert.deepEqual(new WorkspaceStore(disk).state.favorites, store.state.favorites);
  assertConsistent(store);
});

