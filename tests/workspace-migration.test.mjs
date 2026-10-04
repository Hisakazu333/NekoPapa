import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceStore, sampleState, storage, assertConsistent } from "./helpers/workspace.mjs";

function legacySeed() {
  const seed = sampleState();
  delete seed.sampleCleanupVersion;
  seed.activeId = "today";
  seed.favorites = ["today", "weekend"];
  seed.recent = ["today", "inspiration"];
  seed.lastActive = { home: "home", chat: "today", library: "weekend" };
  seed.groupContext = { home: "daily", library: "ideas", projects: "project-neko" };
  return seed;
}

test("old development seed is removed from every live navigation reference and persisted once", () => {
  const saved = storage(legacySeed());
  const store = new WorkspaceStore(saved);
  assert.deepEqual(store.state.items, []);
  assert.deepEqual(store.state.groups, []);
  assert.deepEqual(store.state.tabs, ["home"]);
  assert.equal(store.state.activeId, "home");
  assert.deepEqual(store.state.favorites, []);
  assert.deepEqual(store.state.recent, []);
  assert.deepEqual(store.state.expanded, []);
  assert.deepEqual(store.state.groupContext, {});
  assert.equal(store.state.sampleCleanupVersion, 1);
  assert.equal(store.recoveryData, null);
  assert.deepEqual(new WorkspaceStore(saved).state, store.state);
  assertConsistent(store);
});

test("user-created records with the same titles survive cleanup of old seed IDs", () => {
  const seed = legacySeed();
  seed.items.push({ id: "real-user-session", title: "今天的陪伴", kind: "conversation", groupId: "daily" });
  seed.tabs.push("real-user-session");
  seed.activeId = "real-user-session";
  const store = new WorkspaceStore(storage(seed));
  assert.deepEqual(store.state.items.map(({ id }) => id), ["real-user-session"]);
  assert.deepEqual(store.state.groups.map(({ id }) => id), ["daily"]);
  assert.equal(store.state.activeId, "real-user-session");
  assertConsistent(store);
});

test("renamed, moved, recorded or extended old records are preserved as user data", () => {
  const seed = legacySeed();
  seed.items[0].title = "我的真实对话";
  seed.items[1].groupId = "ideas";
  seed.items[2].body = "我的笔记正文";
  seed.items[4].activity = { status: "completed", updatedAt: "2026-10-04T01:00:00Z", summary: "实际完成", unread: false, pinned: false };
  const store = new WorkspaceStore(storage(seed));
  assert.deepEqual(store.state.items.map(({ id }) => id), ["today", "night", "weekend", "project-session"]);
  assert.equal(store.state.items.find(({ id }) => id === "weekend").body, "我的笔记正文");
  assertConsistent(store);
});

test("renaming a seeded group protects its contents and intentionally pinned sessions survive", () => {
  const seed = legacySeed();
  seed.groups[0].title = "我的对话";
  seed.items[4].activity = { status: "idle", pinned: true, unread: false };
  const store = new WorkspaceStore(storage(seed));
  assert.deepEqual(store.state.items.map(({ id }) => id), ["today", "night", "project-session"]);
  assertConsistent(store);
});

test("archived samples are cleaned without discarding a custom archived item or its restoration", () => {
  const seed = legacySeed();
  const group = seed.groups[1];
  const sample = seed.items[2];
  seed.items = seed.items.filter(({ id }) => id !== sample.id);
  seed.archives = [{ id: "old-archive", archivedAt: "2026-10-03T12:00:00Z", target: "group", group,
    items: [sample, { id: "user-note", title: "自己的笔记", kind: "page", groupId: group.id }],
    favoriteIds: [sample.id, "user-note"], itemPositions: [{ id: sample.id, index: 2 }, { id: "user-note", index: 3 }], groupPosition: 1 }];
  const store = new WorkspaceStore(storage(seed));
  assert.deepEqual(store.state.archives[0].items.map(({ id }) => id), ["user-note"]);
  assert.deepEqual(store.state.archives[0].favoriteIds, ["user-note"]);
  store.restoreArchive("old-archive");
  assert.equal(store.item("user-note").title, "自己的笔记");
  assertConsistent(store);
});

test("empty seeded archives disappear and arbitrary empty user projects remain", () => {
  const seed = legacySeed();
  seed.archives = [{ id: "empty-sample", archivedAt: "2026-10-03T12:00:00Z", target: "group", group: seed.groups[2], items: [], favoriteIds: [], itemPositions: [] }];
  seed.groups.push({ id: "own-project", title: "NekoPapa", kind: "project" });
  const store = new WorkspaceStore(storage(seed));
  assert.deepEqual(store.state.archives, []);
  assert.deepEqual(store.state.groups.map(({ id }) => id), ["own-project"]);
  assertConsistent(store);
});

test("a failed cleanup save keeps the workspace usable and is retried on reload", () => {
  const raw = JSON.stringify(legacySeed());
  const saved = { getItem: (key) => key === "nekopapa.workspace-shell.v1" ? raw : null, setItem: () => { throw new Error("full"); } };
  const store = new WorkspaceStore(saved);
  assert.equal(store.storageAvailable, false);
  assert.deepEqual(store.state.items, []);
  assert.deepEqual(new WorkspaceStore(saved).state.items, []);
  assert.equal(saved.getItem("nekopapa.workspace-shell.v1"), raw);
});

test("the completed cleanup revision prevents deleting subsequently created matching records", () => {
  const seed = sampleState();
  const store = new WorkspaceStore(storage(seed));
  assert.equal(store.state.items.length, 5);
  assert.equal(store.state.groups.length, 3);
  assertConsistent(store);
});
