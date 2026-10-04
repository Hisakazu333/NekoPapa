import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceStore, navigationModes, creationKind, storage, sampleState, workspace, assertConsistent } from "./helpers/workspace.mjs";

test("creation follows the selected group and the current project instead of the first group", () => {
  const store = workspace();
  store.open("weekend");
  assert.equal(store.creationGroup("page"), "ideas");
  store.locateGroup("daily");
  assert.equal(store.creationGroup("page"), "daily");
  assert.equal(store.creationGroup("page", "ideas"), "ideas");
  const project = store.addGroup("project", "第二个项目");
  const session = store.addItem("coding", "当前工作", project);
  assert.equal(store.creationGroup("coding"), project);
  const next = store.addItem("coding", "继续工作", store.creationGroup("coding"));
  assert.equal(store.item(next).groupId, project);
  assert.equal(store.state.activeId, next);
  assert.ok(store.state.tabs.includes(session));
  assertConsistent(store);
});

test("empty-workspace creation is atomic and invalid input leaves no group behind", () => {
  const seed = workspace().state;
  seed.groups = []; seed.items = []; seed.tabs = ["home"]; seed.activeId = "home";
  const store = workspace(seed);
  assert.equal(store.addItemWithGroup("coding", "   ", "项目"), undefined);
  assert.equal(store.addItemWithGroup("page", "页面", "   "), undefined);
  assert.deepEqual(store.state.groups, []);
  const id = store.addItemWithGroup("coding", "  第一段工作  ", "  新项目  ");
  assert.equal(store.state.groups.length, 1);
  assert.equal(store.item(id).title, "第一段工作");
  assert.equal(store.state.groups[0].title, "新项目");
  assert.equal(store.state.navigationMode, "home");
  assertConsistent(store);
});

test("move preserves identity, favorites, tabs, and the user's sidebar browsing context", () => {
  const store = workspace();
  store.open("weekend");
  store.favorite("weekend");
  assert.equal(store.move("weekend", "project-neko"), true);
  assert.equal(store.state.navigationMode, "home");
  assert.equal(store.modeFor("weekend"), "projects");
  assert.equal(store.state.activeId, "weekend");
  assert.ok(store.state.favorites.includes("weekend"));
  assert.equal(store.state.tabs.filter((id) => id === "weekend").length, 1);
  const before = structuredClone(store.state);
  assert.equal(store.move("project-session", "daily"), false);
  assert.deepEqual(store.state, before);
  assert.equal(store.move("weekend", "ideas"), true);
  assert.equal(store.state.navigationMode, "home");
  assert.equal(store.modeFor("weekend"), "library");
  assertConsistent(store);
});

test("search can locate an empty project and creation follows that project", () => {
  const store = workspace();
  const id = store.addGroup("project", "空项目");
  store.open("today");
  store.navigate("chat");
  store.state.sidebarVisible = false;
  store.state.collapsedSections.push("projects-groups");
  assert.equal(store.locateGroup(id), true);
  assert.equal(store.state.activeId, "today");
  assert.equal(store.state.navigationMode, "projects");
  assert.equal(store.state.sidebarVisible, true);
  assert.ok(store.state.expanded.includes(id));
  assert.ok(!store.state.collapsedSections.includes("projects-groups"));
  assert.equal(store.creationGroup("coding"), id);
  assertConsistent(store);
});

test("moving a background entry preserves the active tab and does not pollute history", () => {
  const store = workspace();
  store.open("today");
  const history = [...store.history];
  const tabs = [...store.state.tabs];
  assert.equal(store.move("weekend", "project-neko"), true);
  assert.equal(store.state.activeId, "today");
  assert.equal(store.state.navigationMode, "home");
  assert.deepEqual(store.history, history);
  assert.deepEqual(store.state.tabs, tabs);
  store.open("weekend");
  assert.equal(store.state.navigationMode, "home");
  assertConsistent(store);
});

