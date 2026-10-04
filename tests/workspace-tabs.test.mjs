import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceStore, navigationModes, creationKind, storage, sampleState, workspace, assertConsistent } from "./helpers/workspace.mjs";

test("closing a background tab preserves the view; history cannot reopen it", () => {
  const store = workspace();
  store.open("today");
  store.open("weekend");
  store.close("today");
  assert.equal(store.state.activeId, "weekend");
  assert.equal(store.state.navigationMode, "home");
  assert.ok(store.state.items.some((item) => item.id === "today"));
  store.travel(-1);
  assert.equal(store.state.activeId, "home");
  store.travel(1);
  assert.equal(store.state.activeId, "weekend");
  assert.ok(!store.state.tabs.includes("today"));
  store.restoreClosed();
  assert.deepEqual(store.state.tabs, ["home", "today", "weekend"]);
  assert.equal(store.state.activeId, "today");
  assertConsistent(store);
});

test("batch close restores tab positions and the active view in one operation", () => {
  const store = workspace();
  store.open("project-session");
  const original = [...store.state.tabs];
  store.closeMany(["today", "weekend", "project-session"]);
  assert.deepEqual(store.state.tabs, ["home"]);
  assertConsistent(store);
  store.restoreClosed();
  assert.deepEqual(store.state.tabs, original);
  assert.equal(store.state.activeId, "project-session");
  assertConsistent(store);
});

test("last-tab fallback and restore do not invent an extra home tab", () => {
  const seed = workspace().state;
  seed.tabs = ["today", "weekend"];
  seed.activeId = "weekend";
  const store = workspace(seed);
  store.closeMany(["today", "weekend"]);
  assert.equal(store.state.activeId, "home");
  store.restoreClosed();
  assert.deepEqual(store.state.tabs, ["today", "weekend"]);
  assertConsistent(store);
  store.closeMany(store.state.tabs);
  assert.equal(store.close("home"), false);
  assertConsistent(store);
});

test("disclosing another group does not redirect the next creation", () => {
  const store = workspace();
  store.open("weekend");
  store.toggleGroup("daily");
  if (!store.state.expanded.includes("daily")) store.toggleGroup("daily");
  assert.equal(store.creationGroup("page"), "ideas");
  store.locateGroup("daily");
  assert.equal(store.creationGroup("page"), "daily");
  assertConsistent(store);
});

