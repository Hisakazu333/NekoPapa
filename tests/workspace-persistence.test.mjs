import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceStore, navigationModes, creationKind, storage, sampleState, workspace, assertConsistent } from "./helpers/workspace.mjs";

test("legacy layout preserves a valid independent sidebar category, tabs, and preferences", () => {
  const seed = workspace().state;
  delete seed.lastActive; delete seed.groupContext;
  seed.activeId = "weekend"; seed.navigationMode = "projects";
  seed.sidebarWidth = 273.6016; seed.sidebarVisible = false;
  seed.collapsedSections = ["home-spaces", "library-pages"];
  const store = workspace(seed);
  assert.equal(store.state.navigationMode, "projects");
  assert.deepEqual(store.state.tabs, seed.tabs);
  assert.equal(store.state.sidebarWidth, seed.sidebarWidth);
  assert.equal(store.state.sidebarVisible, false);
  assert.deepEqual(store.state.collapsedSections, seed.collapsedSections);
  assertConsistent(store);
});

test("partial saved-state corruption recovers orphaned content rather than discarding it", () => {
  const seed = workspace().state;
  seed.groups = seed.groups.filter((group) => group.id !== "ideas");
  seed.items.push({ id: "orphan-code", title: "保存的工作", kind: "coding", groupId: "daily" }, { broken: true });
  seed.tabs.push("orphan-code", "missing-id", "weekend");
  seed.activeId = "orphan-code";
  const store = workspace(seed);
  assert.equal(store.item("weekend").title, "周末计划");
  assert.ok(store.state.tabs.includes("orphan-code"));
  assert.ok(store.state.tabs.includes("weekend"));
  assert.ok(!store.state.tabs.includes("missing-id"));
  assertConsistent(store);
});

test("reload preserves independent sidebar browsing and creation context; failed saves remain usable", () => {
  const disk = storage(sampleState());
  const store = new WorkspaceStore(disk);
  store.open("weekend"); store.open("today"); store.navigate("tasks");
  const reloaded = new WorkspaceStore(disk);
  reloaded.navigate("library");
  assert.equal(reloaded.state.activeId, "today");
  assert.equal(reloaded.creationGroup("page"), "daily");
  assertConsistent(reloaded);
  const broken = new WorkspaceStore({ getItem: () => JSON.stringify(sampleState()), setItem: () => { throw new Error("quota"); } });
  broken.open("weekend");
  assert.equal(broken.storageAvailable, false);
  assert.equal(broken.state.navigationMode, "home");
  assertConsistent(broken);
});

test("reordering tabs and groups respects boundaries, preserves identity, and survives reload", () => {
  const disk = storage(sampleState());
  const store = new WorkspaceStore(disk);
  const active = store.state.activeId;
  assert.equal(store.moveTab("home", -1), false);
  assert.equal(store.moveTab("missing", 1), false);
  assert.equal(store.moveTab("today", 1), true);
  assert.deepEqual(store.state.tabs, ["home", "weekend", "today"]);
  assert.equal(store.state.activeId, active);
  assert.equal(store.moveGroup("project-neko", -1), false);
  assert.equal(store.moveGroup("daily", -1), false);
  assert.equal(store.moveGroup("daily", 1), true);
  assert.deepEqual(store.state.groups.map((group) => group.id), ["ideas", "daily", "project-neko"]);
  assert.equal(store.item("today").groupId, "daily");
  const reloaded = new WorkspaceStore(disk);
  assert.deepEqual(reloaded.state.tabs, store.state.tabs);
  assert.deepEqual(reloaded.state.groups, store.state.groups);
  assertConsistent(reloaded);
});

test("damaged saved JSON is backed up before a new workspace can overwrite the primary slot", () => {
  const disk = storage();
  const primary = "nekopapa.workspace-shell.v1";
  const raw = '{"version":1,"items":[{"title":"不能丢的数据"}';
  disk.setItem(primary, raw);
  const store = new WorkspaceStore(disk);
  assert.equal(store.recoveryData, raw);
  assert.equal(disk.getItem(`${primary}.recovery`), raw);
  assert.equal(disk.getItem(primary), raw);
  store.addItemWithGroup("page", "新的页面", "新的空间");
  assert.ok(JSON.parse(disk.getItem(primary)).items.length);
  assert.equal(disk.getItem(`${primary}.recovery`), raw);
  const reloaded = new WorkspaceStore(disk);
  assert.equal(reloaded.recoveryData, raw);
  assert.equal(reloaded.state.items[0].title, "新的页面");
  assertConsistent(reloaded);
});

test("partial malformed content is recovered while preserving the original source for export", () => {
  const seed = sampleState();
  seed.items.push({ id: "legacy", title: "旧格式内容", kind: "unknown", important: "原始内容" });
  const disk = storage(seed);
  const original = disk.getItem("nekopapa.workspace-shell.v1");
  const store = new WorkspaceStore(disk);
  assert.equal(store.recoveryData, original);
  assert.equal(store.item("today").title, "今天的陪伴");
  store.open("weekend");
  assert.equal(disk.getItem("nekopapa.workspace-shell.v1.recovery"), original);
  assertConsistent(store);
});

test("a previous recovery backup is never overwritten by a different damaged source", () => {
  const values = new Map([["nekopapa.workspace-shell.v1", "current damaged"], ["nekopapa.workspace-shell.v1.recovery", "previous damaged"]]);
  const disk = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = new WorkspaceStore(disk);
  store.persist();
  assert.equal(store.recoveryData, "current damaged");
  assert.equal(values.get("nekopapa.workspace-shell.v1.recovery"), "previous damaged");
  assert.ok([...values.entries()].some(([key, value]) => key.startsWith("nekopapa.workspace-shell.v1.recovery.") && value === "current damaged"));
  assert.equal(values.get("nekopapa.workspace-shell.v1.recovery.latest"), "current damaged");
  const reloaded = new WorkspaceStore(disk);
  assert.equal(reloaded.recoveryData, "current damaged");
});

test("failed recovery backup blocks primary saves without making in-memory navigation unusable", () => {
  const primary = "nekopapa.workspace-shell.v1";
  const raw = "unreadable saved data";
  let primaryWrites = 0;
  const disk = { getItem: (key) => key === primary ? raw : null, setItem: (key) => { if (key === primary) primaryWrites++; else throw new Error("quota"); } };
  const store = new WorkspaceStore(disk);
  assert.equal(store.storageAvailable, false);
  assert.equal(store.recoveryData, raw);
  store.navigate("chat");
  assert.equal(store.state.activeId, "home");
  assert.equal(store.state.navigationMode, "chat");
  assert.equal(primaryWrites, 0);
  assert.equal(disk.getItem(primary), raw);
  assertConsistent(store);
});

test("an unreadable primary storage slot cannot be overwritten with an empty fallback", () => {
  let writes = 0;
  const store = new WorkspaceStore({ getItem: () => { throw new Error("storage denied"); }, setItem: () => { writes++; } });
  store.open("chat");
  assert.equal(store.storageAvailable, false);
  assert.equal(writes, 0);
  assertConsistent(store);
});

test("failure to save the latest recovery source blocks primary writes and retains prior backups", () => {
  const primary = "nekopapa.workspace-shell.v1";
  const values = new Map([[primary, "new damaged"], [`${primary}.recovery`, "old damaged"], [`${primary}.recovery.latest`, "old damaged"]]);
  const disk = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (key === `${primary}.recovery.latest`) throw new Error("quota");
      values.set(key, value);
    },
  };
  const store = new WorkspaceStore(disk);
  store.open("chat");
  assert.equal(store.recoveryData, "new damaged");
  assert.equal(store.storageAvailable, false);
  assert.equal(values.get(primary), "new damaged");
  assert.equal(values.get(`${primary}.recovery`), "old damaged");
  assert.ok([...values.entries()].some(([key, value]) => key.startsWith(`${primary}.recovery.`) && key !== `${primary}.recovery.latest` && value === "new damaged"));
});

test("legacy placeholder tabs migrate to real user content without losing workspace data or order", () => {
  const original = workspace();
  original.favorite("today");
  const archiveId = original.archiveItem("night");
  const seed = structuredClone(original.state);
  seed.tabs = ["chat", "today", "lumia", "weekend", "library", "group:daily", "tasks", "tools", "connections", "settings", "memory", "workflows", "project-session"];
  seed.activeId = "connections";
  seed.navigationMode = "tools";
  const store = workspace(seed);
  assert.deepEqual(store.state.tabs, ["today", "weekend", "project-session"]);
  assert.equal(store.state.activeId, "today");
  assert.equal(store.state.navigationMode, "home");
  assert.deepEqual(store.state.items, original.state.items);
  assert.deepEqual(store.state.groups, original.state.groups);
  assert.deepEqual(store.state.archives, original.state.archives);
  assert.deepEqual(store.state.favorites, ["today"]);
  assert.ok(store.state.railOrder.includes("tools"));
  assert.ok(store.state.railOrder.includes("tasks"));
  store.restoreArchive(archiveId);
  assert.equal(store.item("night").title, "睡前聊聊");
  assertConsistent(store);
});

test("a legacy workspace containing only empty system tabs falls back to home", () => {
  const seed = sampleState();
  seed.tabs = ["chat", "library", "projects", "tasks", "tools", "lumia", "group:daily"];
  seed.activeId = "tasks";
  seed.navigationMode = "tasks";
  const store = workspace(seed);
  assert.deepEqual(store.state.tabs, ["home"]);
  assert.equal(store.state.activeId, "home");
  assert.equal(store.state.navigationMode, "home");
  assert.equal(store.state.items.length, seed.items.length);
  assert.equal(store.state.groups.length, seed.groups.length);
  assertConsistent(store);
});

