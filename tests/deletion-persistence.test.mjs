import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceStore, storage, sampleState, workspace, assertConsistent } from "./helpers/workspace.mjs";

const key = "nekopapa.workspace-shell.v1";

test("older workspaces acquire an empty trash without changing existing content or archives", () => {
  const store = workspace();
  store.archiveItem("today");
  const saved = structuredClone(store.state);
  delete saved.trash;
  const reloaded = new WorkspaceStore(storage(saved));
  assert.deepEqual(reloaded.state.trash, []);
  assert.deepEqual(reloaded.state.items, saved.items);
  assert.deepEqual(reloaded.state.archives, saved.archives);
  assert.deepEqual(reloaded.state.tabs, saved.tabs);
  assert.equal(reloaded.recoveryData, null);
  assertConsistent(reloaded);
});

test("corrupt trash records preserve their original source and reject duplicate active or archived IDs", () => {
  const store = workspace();
  store.deleteItem("today");
  store.archiveItem("night");
  const saved = structuredClone(store.state);
  const original = saved.trash[0];
  saved.trash.push(structuredClone(original));
  saved.trash.push({ ...original, id: "duplicate-content" });
  saved.trash.push({ ...original, id: "active-content", items: [store.item("weekend")] });
  saved.trash.push({ ...original, id: "archived-content", items: [store.state.archives[0].items[0]] });
  saved.trash.push({ ...original, id: "system-content", items: [{ id: "home", title: "错误首页", kind: "page" }] });
  saved.trash.push({ ...original, id: store.state.archives[0].id, items: [{ id: "duplicate-record", title: "错误记录", kind: "page" }] });
  saved.trash.push({ ...original, id: "wrong-date", deletedAt: "invalid" });
  const raw = JSON.stringify(saved);
  const disk = storage(saved);
  const reloaded = new WorkspaceStore(disk);
  assert.equal(reloaded.state.trash.length, 1);
  assert.equal(reloaded.state.archives.length, 1);
  assert.equal(reloaded.recoveryData, raw);
  assert.equal(disk.getItem(`${key}.recovery.latest`), raw);
  reloaded.persist();
  assert.equal(disk.getItem(`${key}.recovery.latest`), raw);
  assertConsistent(reloaded);
});

test("invalid archive-origin metadata is backed up instead of restoring deleted archives as active content", () => {
  const store = workspace();
  const archive = store.archiveItem("today");
  store.deleteArchive(archive);
  for (const malformed of [0, "invalid", null]) {
    const saved = structuredClone(store.state);
    saved.trash[0].archivedAt = malformed;
    const reloaded = new WorkspaceStore(storage(saved));
    assert.equal(reloaded.state.trash.length, 0);
    assert.equal(reloaded.item("today"), undefined);
    assert.equal(reloaded.restoreTrash(archive), undefined);
    assert.equal(reloaded.recoveryData, JSON.stringify(saved));
  }
});

test("damaged group children are backed up while valid deleted content remains recoverable", () => {
  const store = workspace();
  const deleted = store.deleteGroup("daily");
  const saved = structuredClone(store.state);
  saved.trash[0].items.push(null, { id: "broken", title: "", kind: "page" });
  const reloaded = new WorkspaceStore(storage(saved));
  assert.ok(reloaded.recoveryData);
  assert.equal(reloaded.state.trash[0].items.length, 2);
  reloaded.restoreTrash(deleted);
  assert.ok(reloaded.item("today"));
  assert.ok(reloaded.item("night"));
  assertConsistent(reloaded);
});

test("orphaned deleted Coding content restores into a compatible project without overwriting a space", () => {
  const store = workspace();
  const deleted = store.deleteItem("project-session");
  const saved = structuredClone(store.state);
  saved.groups.find((group) => group.id === "project-neko").kind = "space";
  const reloaded = new WorkspaceStore(storage(saved));
  reloaded.restoreTrash(deleted);
  const coding = reloaded.item("project-session");
  assert.equal(coding.id, "project-session");
  assert.equal(reloaded.state.groups.find((group) => group.id === coding.groupId).kind, "project");
  assert.equal(reloaded.state.groups.find((group) => group.id === "project-neko").kind, "space");
  assertConsistent(reloaded);
});

test("multiple deletion episodes sharing the same parent survive reload with every child", () => {
  const store = workspace();
  const child = store.deleteItem("night");
  const first = store.deleteGroup("daily");
  store.restoreTrash(child);
  const second = store.deleteGroup("daily");
  assert.equal(store.state.trash.filter((record) => record.target === "group").length, 2);
  const reloaded = new WorkspaceStore(storage(store.state));
  assert.equal(reloaded.state.trash.length, 2);
  assert.equal(reloaded.recoveryData, null);
  reloaded.restoreTrash(first);
  reloaded.restoreTrash(second);
  assert.equal(reloaded.state.groups.filter((group) => group.id === "daily").length, 1);
  assert.ok(reloaded.item("today"));
  assert.ok(reloaded.item("night"));
  assertConsistent(reloaded);
});

test("multiple archive episodes after partial parent recovery no longer discard a snapshot on reload", () => {
  const store = workspace();
  const child = store.archiveItem("night");
  const first = store.archiveGroup("daily");
  store.restoreArchive(child);
  const second = store.archiveGroup("daily");
  const reloaded = new WorkspaceStore(storage(store.state));
  assert.equal(reloaded.state.archives.length, 2);
  assert.equal(reloaded.recoveryData, null);
  reloaded.restoreArchive(first);
  reloaded.restoreArchive(second);
  assert.ok(reloaded.item("today"));
  assert.ok(reloaded.item("night"));
  assertConsistent(reloaded);
});

test("a failed delete save retains a reversible in-memory snapshot and can be retried", () => {
  const disk = storage(sampleState());
  let failing = true;
  const store = new WorkspaceStore({ getItem: disk.getItem, setItem: (key, value) => { if (failing) throw new Error("disk full"); disk.setItem(key, value); } });
  const deleted = store.deleteItem("today");
  assert.ok(deleted);
  assert.equal(store.storageAvailable, false);
  assert.equal(store.state.trash[0].items[0].id, "today");
  assert.ok(new WorkspaceStore(disk).item("today"));
  store.restoreTrash(deleted);
  assert.ok(store.item("today"));
  failing = false;
  store.deleteItem("today");
  assert.equal(store.storageAvailable, true);
  const reloaded = new WorkspaceStore(disk);
  assert.equal(reloaded.item("today"), undefined);
  assert.equal(reloaded.state.trash.length, 1);
  assertConsistent(reloaded);
});

test("failed recovery backup prevents deletion from overwriting the only corrupt source", () => {
  const saved = sampleState();
  saved.trash = "broken source";
  const raw = JSON.stringify(saved);
  const disk = new Map([[key, raw]]);
  const store = new WorkspaceStore({
    getItem: (key) => disk.get(key) ?? null,
    setItem: (key, value) => { if (key.includes(".recovery")) throw new Error("cannot preserve backup"); disk.set(key, value); },
  });
  assert.equal(store.storageAvailable, false);
  assert.ok(store.deleteItem("today"));
  assert.equal(disk.get(key), raw);
  assert.equal(store.recoveryData, raw);
  assert.ok(store.restoreTrash(store.state.trash[0].id));
  assert.equal(disk.get(key), raw);
});

test("a legacy user item named by the ID trash is preserved because management is not a content ID", () => {
  const saved = sampleState();
  saved.items.push({ id: "trash", title: "用户自建页面", kind: "page", groupId: "ideas" });
  saved.tabs.push("trash");
  const store = new WorkspaceStore(storage(saved));
  assert.equal(store.item("trash").title, "用户自建页面");
  assert.equal(store.open("trash"), true);
  const deleted = store.deleteItem("trash");
  assert.ok(deleted);
  store.restoreTrash(deleted);
  assert.equal(store.item("trash").title, "用户自建页面");
  assertConsistent(store);
});
