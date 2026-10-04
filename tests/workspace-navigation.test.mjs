import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceStore, navigationModes, creationKind, storage, sampleState, workspace, assertConsistent } from "./helpers/workspace.mjs";

test("sidebar browsing and active content are independent and never stack overview tabs", () => {
  const store = workspace();
  store.open("today");
  const tabs = [...store.state.tabs];
  const history = [...store.history];
  store.navigate("tasks");
  assert.equal(store.state.activeId, "today");
  assert.equal(store.state.navigationMode, "tasks");
  store.navigate("chat");
  assert.equal(store.state.activeId, "today");
  assert.deepEqual(store.state.tabs, tabs);
  assert.deepEqual(store.history, history);
  store.open("weekend");
  assert.equal(store.state.navigationMode, "chat");
  store.open("project-session");
  assert.equal(store.state.navigationMode, "chat");
  store.open("settings");
  assert.equal(store.state.navigationMode, "chat");
  store.navigate("library");
  assert.equal(store.state.activeId, "project-session");
  store.navigate("home");
  assert.equal(store.state.activeId, "project-session");
  assert.equal(store.state.tabs.filter((id) => id === "weekend").length, 1);
  assertConsistent(store);
});

test("first launch starts with an empty user workspace", () => {
  const store = new WorkspaceStore(storage());
  assert.deepEqual(store.state.groups, []);
  assert.deepEqual(store.state.items, []);
  assert.deepEqual(store.state.tabs, ["home"]);
  assertConsistent(store);
});

test("empty categories are sidebar contexts without inventing content tabs or history", () => {
  const seed = workspace().state;
  seed.tabs = ["home"];
  const store = workspace(seed);
  for (const mode of navigationModes) {
    store.navigate(mode);
    assert.equal(store.state.activeId, "home");
    assert.equal(store.state.navigationMode, mode);
    assert.deepEqual(store.state.tabs, ["home"]);
    assert.deepEqual(store.history, ["home"]);
    assertConsistent(store);
  }
});

test("back/forward affect content history while retaining the independently selected sidebar", () => {
  const store = workspace();
  store.open("today");
  store.open("project-session");
  store.open("weekend");
  store.navigate("projects");
  store.travel(-1);
  assert.equal(store.state.activeId, "project-session");
  assert.equal(store.state.navigationMode, "projects");
  store.travel(-1);
  assert.equal(store.state.activeId, "today");
  assert.equal(store.state.navigationMode, "projects");
  store.travel(1);
  assert.equal(store.state.activeId, "project-session");
  store.open("inspiration");
  const current = store.state.activeId;
  store.travel(1);
  assert.equal(store.state.activeId, current);
  assert.ok(!store.history.includes("weekend"));
  assertConsistent(store);
});

test("unavailable modules cannot create chat entries through the contextual shortcut", () => {
  assert.equal(creationKind("tasks"), undefined);
  assert.equal(creationKind("tools"), undefined);
  assert.equal(creationKind("projects"), "coding");
  const store = workspace();
  const before = structuredClone(store.state);
  store.open("unknown"); store.favorite("unknown"); store.toggleGroup("unknown");
  assert.equal(store.addItem("coding", "工作", "daily"), undefined);
  assert.equal(store.addItem("page", "  ", "ideas"), undefined);
  assert.deepEqual(store.state, before);
});

test("unimplemented system destinations cannot create placeholder tabs", () => {
  const store = workspace();
  store.state.collapsedSections.push("tools-workspace", "tools-connections");
  const before = structuredClone(store.state);
  for (const id of ["chat", "library", "projects", "tasks", "tools", "lumia", "memory", "workflows", "connections", "settings", "group:daily"]) assert.equal(store.open(id), false);
  assert.deepEqual(store.state, before);
  assertConsistent(store);
});

test("mixed user navigation and tab operations always preserve the shell invariants", () => {
  const store = workspace();
  let seed = 54321;
  const random = (length) => { seed = (seed * 16807) % 2147483647; return seed % length; };
  for (let step = 0; step < 400; step++) {
    switch (random(7)) {
      case 0: store.navigate(navigationModes[random(navigationModes.length)]); break;
      case 1: store.open(["today", "weekend", "project-session", "settings", "lumia"][random(5)]); break;
      case 2: store.close(store.state.tabs[random(store.state.tabs.length)]); break;
      case 3: store.restoreClosed(); break;
      case 4: store.travel(random(2) ? 1 : -1); break;
      case 5: store.closeMany(store.state.tabs.slice(random(store.state.tabs.length) + 1)); break;
      case 6: store.move("weekend", random(2) ? "ideas" : "project-neko"); break;
    }
    assertConsistent(store);
  }
});

test("group selection reveals its tree without opening placeholder group tabs", () => {
  const disk = storage(sampleState());
  const store = new WorkspaceStore(disk);
  store.locateGroup("daily");
  assert.deepEqual(store.item("group:daily"), { id: "group:daily", title: "日常陪伴", kind: "overview", groupId: "daily" });
  assert.equal(store.state.navigationMode, "library");
  assert.equal(store.state.activeId, "home");
  assert.deepEqual(store.state.tabs, ["home", "today", "weekend"]);
  assert.equal(store.creationGroup("page"), "daily");
  assert.ok(!store.state.recent.includes("group:daily"));
  store.rename("daily", "我们的日常");
  assert.equal(store.item("group:daily").title, "我们的日常");
  const reloaded = new WorkspaceStore(disk);
  assert.equal(reloaded.state.activeId, "home");
  assert.equal(reloaded.state.navigationMode, "library");
  assert.equal(reloaded.open("group:daily"), false);
  reloaded.navigate("chat");
  reloaded.locateGroup("project-neko");
  assert.equal(reloaded.state.navigationMode, "projects");
  assert.equal(reloaded.state.activeId, "home");
  assert.ok(!reloaded.state.tabs.includes("group:project-neko"));
  assert.equal(reloaded.locateGroup("missing"), false);
  assertConsistent(reloaded);
});

test("sidebar group selection preserves a visible browsing context while global location reveals its category", () => {
  const store = workspace();
  store.open("today");
  store.navigate("chat");
  const tabs = [...store.state.tabs];
  const history = [...store.history];
  assert.equal(store.locateGroup("daily", true), true);
  assert.equal(store.state.navigationMode, "library");
  assert.equal(store.creationGroup("conversation"), "daily");
  assert.equal(store.locateGroup("daily", true), true);
  assert.equal(store.state.navigationMode, "library");
  assert.equal(store.locateGroup("daily"), true);
  assert.equal(store.state.navigationMode, "library");
  store.navigate("chat");
  assert.equal(store.locateGroup("project-neko", true), true);
  assert.equal(store.state.navigationMode, "projects");
  store.move("night", "project-neko");
  store.navigate("chat");
  assert.equal(store.locateGroup("project-neko", true), true);
  assert.equal(store.state.navigationMode, "projects");
  assert.equal(store.locateGroup("project-neko"), true);
  assert.equal(store.state.navigationMode, "projects");
  store.navigate("home");
  store.locateGroup("daily", true);
  assert.equal(store.state.navigationMode, "library");
  store.navigate("tools");
  store.locateGroup("daily", true);
  assert.equal(store.state.navigationMode, "library");
  assert.deepEqual(store.state.tabs, tabs);
  assert.deepEqual(store.history, history);
  assert.equal(store.state.activeId, "today");
  assertConsistent(store);
});

test("a project's ordinary conversation reveals its activity section and retains its creation context", () => {
  const store = workspace();
  store.move("today", "project-neko");
  store.navigate("chat");
  store.state.expanded = store.state.expanded.filter((id) => id !== "project-neko");
  delete store.item("today").activity.updatedAt;
  store.state.collapsedSections.push("chat-activity-history");
  store.open("today");
  assert.equal(store.state.navigationMode, "chat");
  assert.equal(store.state.activeId, "today");
  assert.ok(!store.state.expanded.includes("project-neko"));
  assert.ok(!store.state.collapsedSections.includes("chat-activity-history"));
  assert.equal(store.state.groupContext.chat, "project-neko");
  assert.equal(store.creationGroup("conversation"), "project-neko");
  assertConsistent(store);
});
