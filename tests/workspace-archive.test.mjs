import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceStore, navigationModes, creationKind, storage, sampleState, workspace, assertConsistent } from "./helpers/workspace.mjs";

test("archiving active content removes all view references and restores its identity and favorite", () => {
  const store = workspace();
  store.open("today");
  store.favorite("today");
  const original = structuredClone(store.item("today"));
  const id = store.archiveItem("today");
  assert.ok(id);
  assert.equal(store.item("today"), undefined);
  assert.ok(!store.state.favorites.includes("today"));
  assert.ok(!store.state.recent.includes("today"));
  assert.ok(!store.history.includes("today"));
  assert.equal(store.restoreClosed(), undefined);
  assert.ok(!store.canRestoreClosed);
  assertConsistent(store);
  const tabs = [...store.state.tabs];
  assert.deepEqual(store.restoreArchive(id), { itemId: "today", groupId: "daily" });
  assert.deepEqual(store.item("today"), original);
  assert.ok(store.state.favorites.includes("today"));
  assert.deepEqual(store.state.tabs, tabs);
  assert.equal(store.restoreArchive(id), undefined);
  assertConsistent(store);
});

test("archiving a background item prunes old closed batches without disturbing unrelated recovery", () => {
  const store = workspace();
  store.open("project-session");
  store.closeMany(["today", "weekend"]);
  const active = store.state.activeId;
  const id = store.archiveItem("today");
  assert.equal(store.state.activeId, active);
  assert.equal(store.restoreClosed(), "weekend");
  assert.ok(!store.state.tabs.includes("today"));
  store.restoreArchive(id);
  assert.equal(store.restoreClosed(), undefined);
  assert.ok(!store.state.tabs.includes("today"));
  assertConsistent(store);
});

test("group archive captures only current members and closes legacy group tabs and child views", () => {
  const store = workspace();
  store.favorite("today");
  store.locateGroup("daily");
  store.open("group:daily");
  store.open("night");
  store.move("night", "ideas");
  const originalOrder = store.state.items.map((item) => item.id);
  const id = store.archiveGroup("daily");
  assert.ok(id);
  assert.deepEqual(store.state.archives[0].items.map((item) => item.id), ["today"]);
  assert.equal(store.item("group:daily"), undefined);
  assert.equal(store.item("today"), undefined);
  assert.equal(store.item("night").groupId, "ideas");
  assert.ok(!store.state.expanded.includes("daily"));
  assert.ok(!Object.values(store.state.groupContext).includes("daily"));
  assert.equal(store.restoreClosed(), undefined);
  assertConsistent(store);
  assert.deepEqual(store.restoreArchive(id), { groupId: "daily" });
  assert.deepEqual(store.state.items.map((item) => item.id), originalOrder);
  assert.equal(store.item("group:daily").title, "日常陪伴");
  assert.ok(store.state.favorites.includes("today"));
  assertConsistent(store);
});

test("restoring separately archived content can recover its parent before the group archive", () => {
  const store = workspace();
  const itemArchive = store.archiveItem("today");
  const groupArchive = store.archiveGroup("daily");
  assert.deepEqual(store.state.archives.find((record) => record.id === groupArchive).items.map((item) => item.id), ["night"]);
  store.restoreArchive(itemArchive);
  assert.equal(store.item("today").groupId, "daily");
  assert.equal(store.state.groups.filter((group) => group.id === "daily").length, 1);
  store.rename("daily", "恢复后重新命名");
  store.restoreArchive(groupArchive);
  assert.equal(store.state.groups.filter((group) => group.id === "daily").length, 1);
  assert.equal(store.state.groups.find((group) => group.id === "daily").title, "恢复后重新命名");
  assert.equal(store.item("night").groupId, "daily");
  assertConsistent(store);
});

test("archives persist across reload, including empty projects, without resurrecting active content", () => {
  const disk = storage(sampleState());
  const store = new WorkspaceStore(disk);
  const empty = store.addGroup("project", "空项目");
  const emptyArchive = store.archiveGroup(empty);
  store.open("project-session");
  const projectArchive = store.archiveGroup("project-neko");
  assert.equal(store.open("archive"), false);
  store.open("home");
  const reloaded = new WorkspaceStore(disk);
  assert.equal(reloaded.state.activeId, "home");
  assert.equal(reloaded.state.navigationMode, "home");
  assert.equal(reloaded.item("project-session"), undefined);
  assert.equal(reloaded.state.archives.length, 2);
  reloaded.restoreArchive(emptyArchive);
  assert.equal(reloaded.item(`group:${empty}`).title, "空项目");
  reloaded.restoreArchive(projectArchive);
  assert.equal(reloaded.item("project-session").groupId, "project-neko");
  assertConsistent(reloaded);
});

test("invalid archive operations and invalid group creation do not mutate the workspace", () => {
  const store = workspace();
  const before = structuredClone(store.state);
  for (const id of ["home", "lumia", "settings", "archive", "group:daily", "missing"]) assert.equal(store.archiveItem(id), undefined);
  assert.equal(store.archiveGroup("missing"), undefined);
  assert.equal(store.restoreArchive("missing"), undefined);
  assert.equal(store.addItemWithGroup("coding", "工作", "空间", "space"), undefined);
  assert.equal(store.addItemWithGroup("page", "页面", "空间", "unknown"), undefined);
  assert.deepEqual(store.state, before);
  const page = store.addItemWithGroup("page", "项目页面", "新的项目", "project");
  assert.equal(store.state.groups.find((group) => group.id === store.item(page).groupId).kind, "project");
  assert.equal(store.state.navigationMode, "home");
  assertConsistent(store);
});

test("archive hydration rejects corrupt records, duplicate identities, and system content", () => {
  const store = workspace();
  store.archiveItem("today");
  const seed = structuredClone(store.state);
  seed.archives.push(structuredClone(seed.archives[0]));
  seed.archives.push({ ...structuredClone(seed.archives[0]), id: "bad-date", archivedAt: "invalid", items: [{ id: "bad", title: "坏记录", kind: "page" }] });
  seed.archives.push({ ...structuredClone(seed.archives[0]), id: "active-copy", items: [{ ...store.item("weekend") }] });
  seed.archives.push({ ...structuredClone(seed.archives[0]), id: "system-copy", items: [{ id: "home", title: "错误主页", kind: "page" }] });
  seed.archives.push({ ...structuredClone(seed.archives[0]), id: "orphan", group: undefined, items: [{ id: "orphan-code", title: "保存的工作", kind: "coding", groupId: "lost-project" }], favoriteIds: ["orphan-code", "missing"], itemPositions: [{ id: "orphan-code", index: -1 }] });
  const reloaded = workspace(seed);
  assert.equal(reloaded.state.archives.length, 2);
  assert.equal(reloaded.item("today"), undefined);
  assert.equal(reloaded.item("weekend").title, "周末计划");
  reloaded.restoreArchive("orphan");
  const group = reloaded.state.groups.find((entry) => entry.id === reloaded.item("orphan-code").groupId);
  assert.equal(group.kind, "project");
  assert.ok(reloaded.state.favorites.includes("orphan-code"));
  assertConsistent(reloaded);
});

test("mixed archive, restore, close, move, and navigation keep every reference valid", () => {
  const store = workspace();
  let seed = 65329;
  const random = (length) => { seed = (seed * 16807) % 2147483647; return seed % length; };
  for (let step = 0; step < 800; step++) {
    switch (random(10)) {
      case 0: store.navigate(navigationModes[random(navigationModes.length)]); break;
      case 1: if (store.state.items.length) store.open(store.state.items[random(store.state.items.length)].id); break;
      case 2: store.close(store.state.tabs[random(store.state.tabs.length)]); break;
      case 3: store.restoreClosed(); break;
      case 4: store.travel(random(2) ? 1 : -1); break;
      case 5: if (store.state.items.length) store.archiveItem(store.state.items[random(store.state.items.length)].id); break;
      case 6: if (store.state.groups.length) store.archiveGroup(store.state.groups[random(store.state.groups.length)].id); break;
      case 7: if (store.state.archives.length) store.restoreArchive(store.state.archives[random(store.state.archives.length)].id); break;
      case 8: if (store.state.groups.length) store.locateGroup(store.state.groups[random(store.state.groups.length)].id); break;
      case 9: store.moveTab(store.state.tabs[random(store.state.tabs.length)], random(2) ? 1 : -1); break;
    }
    assertConsistent(store);
  }
});

test("restoring an item uses the later archived parent metadata without overwriting subsequent active edits", () => {
  const store = workspace();
  const itemArchive = store.archiveItem("today");
  store.rename("daily", "后来重新命名的日常");
  store.moveGroup("daily", 1);
  store.toggleGroup("daily");
  const groupArchive = store.archiveGroup("daily");
  store.restoreArchive(itemArchive);
  assert.equal(store.state.groups.find((group) => group.id === "daily").title, "后来重新命名的日常");
  assert.deepEqual(store.state.groups.map((group) => group.id), ["ideas", "daily", "project-neko"]);
  assert.ok(!store.state.expanded.includes("daily"));
  store.rename("daily", "恢复后的新名字");
  store.restoreArchive(groupArchive);
  assert.equal(store.state.groups.find((group) => group.id === "daily").title, "恢复后的新名字");
  assert.equal(store.item("night").groupId, "daily");
  assertConsistent(store);
});

test("legacy archive tabs are discarded on reload while saved archives remain recoverable", () => {
  const store = workspace();
  const archived = store.archiveItem("today");
  const seed = structuredClone(store.state);
  seed.tabs = ["archive", "weekend"];
  seed.activeId = "archive";
  seed.lastActive.home = "archive";
  const reloaded = workspace(seed);
  assert.deepEqual(reloaded.state.tabs, ["weekend"]);
  assert.equal(reloaded.state.activeId, "weekend");
  assert.equal(reloaded.state.navigationMode, "home");
  assert.equal(reloaded.open("archive"), false);
  assert.equal(reloaded.item("archive"), undefined);
  assert.equal(reloaded.state.archives.length, 1);
  reloaded.restoreArchive(archived);
  assert.equal(reloaded.item("today").title, "今天的陪伴");
  assertConsistent(reloaded);
  seed.tabs = ["archive"];
  const onlyArchive = workspace(seed);
  assert.deepEqual(onlyArchive.state.tabs, ["home"]);
  assertConsistent(onlyArchive);
});

test("sidebar mode stays independent through tab close, restore, archive, and active item movement", () => {
  const store = workspace();
  store.navigate("tools");
  store.open("weekend");
  store.move("weekend", "project-neko");
  assert.equal(store.state.navigationMode, "tools");
  store.close("weekend");
  assert.equal(store.state.navigationMode, "tools");
  store.restoreClosed();
  assert.equal(store.state.navigationMode, "tools");
  const archive = store.archiveItem("weekend");
  assert.equal(store.state.navigationMode, "tools");
  store.restoreArchive(archive);
  assert.equal(store.state.navigationMode, "tools");
  assertConsistent(store);
});

test("ordinary sessions carry their companion identity through creation, reload, and archival restore", () => {
  const disk = storage(sampleState());
  const store = new WorkspaceStore(disk);
  assert.equal(store.item("today").companionId, "lumia");
  const defaultSession = store.addItem("conversation", "默认角色", "daily");
  assert.equal(store.item(defaultSession).companionId, "lumia");
  const custom = store.addItem("conversation", "自定义角色", "daily", "mizi");
  assert.equal(store.item(custom).companionId, "mizi");
  const archive = store.archiveItem(custom);
  const reloaded = new WorkspaceStore(disk);
  assert.equal(reloaded.state.archives.find((record) => record.id === archive).items[0].companionId, "mizi");
  reloaded.restoreArchive(archive);
  assert.equal(reloaded.item(custom).companionId, "mizi");
  const atomic = reloaded.addItemWithGroup("conversation", "新角色会话", "新空间", "space", "mizi");
  assert.equal(reloaded.item(atomic).companionId, "mizi");
  assert.equal(reloaded.item("weekend").companionId, undefined);
  assertConsistent(reloaded);
});

test("legacy archived conversations receive the default companion identity on hydration", () => {
  const store = workspace();
  const id = store.archiveItem("today");
  const seed = structuredClone(store.state);
  delete seed.archives[0].items[0].companionId;
  const reloaded = workspace(seed);
  assert.equal(reloaded.state.archives[0].items[0].companionId, "lumia");
  reloaded.restoreArchive(id);
  assert.equal(reloaded.item("today").companionId, "lumia");
});

test("archival recovery restores manually ordered favorite positions across reload", () => {
  const disk = storage(sampleState());
  const store = new WorkspaceStore(disk);
  for (const id of ["today", "weekend", "night", "inspiration"]) store.favorite(id);
  store.reorderFavorite("inspiration", "today");
  const order = [...store.state.favorites];
  const archiveId = store.archiveGroup("daily");
  assert.deepEqual(store.state.favorites, ["inspiration", "weekend"]);
  const reloaded = new WorkspaceStore(disk);
  reloaded.restoreArchive(archiveId);
  assert.deepEqual(reloaded.state.favorites, order);
  const itemArchive = reloaded.archiveItem("inspiration");
  reloaded.restoreArchive(itemArchive);
  assert.deepEqual(reloaded.state.favorites, order);
  assertConsistent(reloaded);
});

test("older archives without favorite positions still restore memberships safely", () => {
  const store = workspace();
  store.favorite("today"); store.favorite("weekend");
  const archive = store.archiveItem("today");
  const seed = structuredClone(store.state);
  delete seed.archives[0].favoritePositions;
  const reloaded = workspace(seed);
  reloaded.restoreArchive(archive);
  assert.deepEqual(reloaded.state.favorites, ["weekend", "today"]);
  assertConsistent(reloaded);
});
