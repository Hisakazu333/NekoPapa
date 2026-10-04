import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceStore, storage, sampleState, workspace, assertConsistent, navigationModes } from "./helpers/workspace.mjs";

test("closing, archiving, and deleting the same content have distinct recoverable outcomes", () => {
  const store = workspace();
  store.open("today");
  store.close("today");
  assert.ok(store.item("today"));
  assert.equal(store.state.archives.length, 0);
  assert.equal(store.state.trash.length, 0);
  assert.equal(store.restoreClosed(), "today");
  const archived = store.archiveItem("today");
  assert.equal(store.state.archives[0].id, archived);
  assert.equal(store.state.trash.length, 0);
  assert.equal(store.restoreClosed(), undefined);
  store.restoreArchive(archived);
  store.open("today");
  const deleted = store.deleteItem("today");
  assert.equal(store.state.archives.length, 0);
  assert.equal(store.state.trash[0].id, deleted);
  assert.equal(store.state.trash[0].archivedAt, undefined);
  assert.equal(store.item("today"), undefined);
  assert.equal(store.open("today"), false);
  assert.equal(store.restoreClosed(), undefined);
  assertConsistent(store);
});

test("deleting active content removes its views, favorites, recent entries, and history", () => {
  const store = workspace();
  store.open("today");
  store.favorite("today");
  store.pinSession("today");
  const saved = structuredClone(store.item("today"));
  const record = store.deleteItem("today");
  assert.equal(store.item("today"), undefined);
  assert.ok(!store.state.tabs.includes("today"));
  assert.ok(!store.state.favorites.includes("today"));
  assert.ok(!store.state.recent.includes("today"));
  assert.ok(!store.history.includes("today"));
  assert.ok(!Object.values(store.state.lastActive).includes("today"));
  assert.deepEqual(store.state.trash[0].items, [saved]);
  assert.ok(Number.isFinite(Date.parse(store.state.trash[0].deletedAt)));
  assertConsistent(store);
  const before = { tabs: [...store.state.tabs], active: store.state.activeId, history: [...store.history], mode: store.state.navigationMode };
  assert.deepEqual(store.restoreTrash(record), { itemId: "today", groupId: "daily" });
  assert.deepEqual(store.item("today"), saved);
  assert.deepEqual(store.state.tabs, before.tabs);
  assert.equal(store.state.activeId, before.active);
  assert.deepEqual(store.history, before.history);
  assert.equal(store.state.navigationMode, before.mode);
  assert.ok(store.state.favorites.includes("today"));
  assert.equal(store.restoreTrash(record), undefined);
  assertConsistent(store);
});

test("deleting a background entry preserves current content and unrelated closed-tab recovery", () => {
  const store = workspace();
  store.open("project-session");
  store.closeMany(["today", "weekend"]);
  const active = store.state.activeId;
  store.deleteItem("today");
  assert.equal(store.state.activeId, active);
  assert.equal(store.restoreClosed(), "weekend");
  assert.ok(!store.state.tabs.includes("today"));
  assertConsistent(store);
});

test("group deletion captures only current members and leaves separately archived or moved content intact", () => {
  const store = workspace();
  const archive = store.archiveItem("today");
  store.move("night", "ideas");
  const deleted = store.deleteGroup("daily");
  assert.equal(store.state.trash[0].items.length, 0);
  assert.equal(store.item("night").groupId, "ideas");
  assert.equal(store.state.archives[0].id, archive);
  assert.ok(!store.state.groups.some((group) => group.id === "daily"));
  store.restoreTrash(deleted);
  assert.ok(store.state.groups.some((group) => group.id === "daily"));
  assert.equal(store.item("today"), undefined);
  store.restoreArchive(archive);
  assert.equal(store.item("today").groupId, "daily");
  assertConsistent(store);
});

test("group deletion and reload restore stable identities, original order, favorites, roles, and expansion", () => {
  const disk = storage(sampleState());
  const store = new WorkspaceStore(disk);
  for (const id of ["inspiration", "today", "weekend", "night"]) store.favorite(id);
  store.item("today").companionId = "custom-character";
  store.pinSession("night");
  store.locateGroup("daily");
  const groups = structuredClone(store.state.groups);
  const items = structuredClone(store.state.items);
  const favorites = [...store.state.favorites];
  const deleted = store.deleteGroup("daily");
  assert.ok(!Object.values(store.state.groupContext).includes("daily"));
  assert.ok(!store.state.expanded.includes("daily"));
  const reloaded = new WorkspaceStore(disk);
  assert.equal(reloaded.state.trash.length, 1);
  assertConsistent(reloaded);
  assert.deepEqual(reloaded.restoreTrash(deleted), { groupId: "daily" });
  assert.deepEqual(reloaded.state.groups, groups);
  assert.deepEqual(reloaded.state.items, items);
  assert.deepEqual(reloaded.state.favorites, favorites);
  assert.ok(reloaded.state.expanded.includes("daily"));
  assert.ok(reloaded.item("night").activity.pinned);
  assert.equal(reloaded.item("today").companionId, "custom-character");
  assertConsistent(reloaded);
});

test("empty deleted projects remain restorable across reload", () => {
  const disk = storage();
  const store = new WorkspaceStore(disk);
  const group = store.addGroup("project", "空的开发项目");
  const deleted = store.deleteGroup(group);
  assert.ok(deleted);
  const reloaded = new WorkspaceStore(disk);
  assert.equal(reloaded.state.trash[0].items.length, 0);
  reloaded.restoreTrash(deleted);
  assert.deepEqual(reloaded.state.groups, [{ id: group, title: "空的开发项目", kind: "project" }]);
  assertConsistent(reloaded);
});

test("deleted archived content restores to the same archive record without reopening or changing content", () => {
  const disk = storage(sampleState());
  const store = new WorkspaceStore(disk);
  store.favorite("today");
  const archive = store.archiveItem("today");
  const original = structuredClone(store.state.archives[0]);
  const before = { tabs: [...store.state.tabs], active: store.state.activeId, groups: structuredClone(store.state.groups) };
  assert.equal(store.deleteArchive(archive), archive);
  assert.equal(store.state.archives.length, 0);
  assert.equal(store.restoreArchive(archive), undefined);
  const reloaded = new WorkspaceStore(disk);
  assert.deepEqual(reloaded.restoreTrash(archive), { archiveId: archive });
  assert.deepEqual(reloaded.state.archives[0], original);
  assert.deepEqual(reloaded.state.tabs, before.tabs);
  assert.equal(reloaded.state.activeId, before.active);
  assert.deepEqual(reloaded.state.groups, before.groups);
  assert.equal(reloaded.item("today"), undefined);
  assert.equal(reloaded.state.trash.length, 0);
  reloaded.restoreArchive(archive);
  assert.ok(reloaded.state.favorites.includes("today"));
  assertConsistent(reloaded);
});

test("deleted archived groups retain their group and children until restored in two explicit steps", () => {
  const store = workspace();
  const archive = store.archiveGroup("project-neko");
  const original = structuredClone(store.state.archives[0]);
  store.deleteArchive(archive);
  store.restoreTrash(archive);
  assert.deepEqual(store.state.archives[0], original);
  assert.ok(!store.state.groups.some((group) => group.id === "project-neko"));
  assert.equal(store.item("project-session"), undefined);
  store.restoreArchive(archive);
  assert.equal(store.item("project-session").groupId, "project-neko");
  assertConsistent(store);
});

test("restoring a separately deleted child uses the later parent snapshot, then preserves active edits", () => {
  const store = workspace();
  const child = store.deleteItem("today");
  store.rename("daily", "新的日常名称");
  store.moveGroup("daily", 1);
  store.toggleGroup("daily");
  const parent = store.deleteGroup("daily");
  store.restoreTrash(child);
  assert.equal(store.state.groups.find((group) => group.id === "daily").title, "新的日常名称");
  assert.deepEqual(store.state.groups.map((group) => group.id), ["ideas", "daily", "project-neko"]);
  assert.ok(!store.state.expanded.includes("daily"));
  store.rename("daily", "恢复后的修改");
  store.restoreTrash(parent);
  assert.equal(store.state.groups.filter((group) => group.id === "daily").length, 1);
  assert.equal(store.state.groups.find((group) => group.id === "daily").title, "恢复后的修改");
  assert.equal(store.item("night").groupId, "daily");
  assertConsistent(store);
});

test("restoring an archived child can reconstruct a deleted parent without restoring its other children", () => {
  const store = workspace();
  const child = store.archiveItem("today");
  store.rename("daily", "删除前的名称");
  const parent = store.deleteGroup("daily");
  store.restoreArchive(child);
  assert.equal(store.item("today").groupId, "daily");
  assert.equal(store.state.groups.find((group) => group.id === "daily").title, "删除前的名称");
  assert.equal(store.item("night"), undefined);
  store.restoreTrash(parent);
  assert.equal(store.state.groups.filter((group) => group.id === "daily").length, 1);
  assertConsistent(store);
});

test("running or waiting sessions block deletion atomically for items, groups, and archive records", () => {
  for (const status of ["running", "waiting"]) {
    const store = workspace();
    store.recordSessionActivity("today", { status, updatedAt: "2026-10-04T14:00:00.000Z" });
    const before = structuredClone(store.state);
    assert.equal(store.deleteItem("today"), undefined);
    assert.equal(store.deleteGroup("daily"), undefined);
    assert.deepEqual(store.state, before);
    const archive = store.archiveItem("today");
    const archived = structuredClone(store.state);
    assert.equal(store.deleteArchive(archive), undefined);
    assert.deepEqual(store.state, archived);
    store.recordSessionActivity("today", { status: "completed", updatedAt: "2026-10-04T14:01:00.000Z" });
    assert.equal(store.deleteArchive(archive), archive);
    assertConsistent(store);
  }
});

test("late events for deleted sessions cannot resurrect them or invent running trash content", () => {
  const store = workspace();
  store.deleteItem("today");
  const before = structuredClone(store.state);
  assert.equal(store.recordSessionActivity("today", { status: "running", updatedAt: "2026-10-04T14:00:00.000Z" }), false);
  assert.deepEqual(store.state, before);
});

test("invalid deletes, restore calls, and protected system IDs have no side effects", () => {
  const store = workspace();
  const before = structuredClone(store.state);
  for (const id of ["home", "lumia", "settings", "archive", "trash", "group:daily", "missing"]) {
    assert.equal(store.deleteItem(id), undefined);
    assert.equal(store.deleteArchive(id), undefined);
    assert.equal(store.restoreTrash(id), undefined);
  }
  assert.equal(store.deleteGroup("missing"), undefined);
  assert.deepEqual(store.state, before);
});

test("mixed deletion, archive, restore, movement, and tab actions keep identities and reload valid", () => {
  let store = workspace();
  let seed = 70331;
  const random = (length) => { seed = (seed * 16807) % 2147483647; return seed % length; };
  for (let step = 0; step < 600; step++) {
    const item = store.state.items[random(store.state.items.length)];
    const group = store.state.groups[random(store.state.groups.length)];
    const archive = store.state.archives[random(store.state.archives.length)];
    const deleted = store.state.trash[random(store.state.trash.length)];
    switch (random(12)) {
      case 0: store.navigate(navigationModes[random(navigationModes.length)]); break;
      case 1: if (item) store.open(item.id); break;
      case 2: store.close(store.state.tabs[random(store.state.tabs.length)]); break;
      case 3: store.restoreClosed(); break;
      case 4: if (item) store.deleteItem(item.id); break;
      case 5: if (group) store.deleteGroup(group.id); break;
      case 6: if (archive) store.deleteArchive(archive.id); break;
      case 7: if (deleted) store.restoreTrash(deleted.id); break;
      case 8: if (item) store.archiveItem(item.id); break;
      case 9: if (group) store.archiveGroup(group.id); break;
      case 10: if (archive) store.restoreArchive(archive.id); break;
      case 11: if (group) store.locateGroup(group.id); break;
    }
    assertConsistent(store);
    if (step % 10 === 0) {
      const before = structuredClone(store.state);
      store = new WorkspaceStore(storage(before));
      assert.deepEqual(store.state.items.map((item) => item.id), before.items.map((item) => item.id));
      assert.deepEqual(store.state.archives.map((record) => record.id), before.archives.map((record) => record.id));
      assert.deepEqual(store.state.trash.map((record) => record.id), before.trash.map((record) => record.id));
      assert.equal(store.recoveryData, null);
      assertConsistent(store);
    }
  }
});
