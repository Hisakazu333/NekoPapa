import assert from "node:assert/strict";
import { stateModule } from "./production.mjs";
export const { WorkspaceStore, navigationModes, creationKind } = stateModule;
export function storage(seed) {
  const values = new Map(seed ? [["nekopapa.workspace-shell.v1", JSON.stringify(seed)]] : []);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, next) => { values.set(key, next); } };
}

export function sampleState() {
  return {
    ...new WorkspaceStore(storage()).state,
    groups: [
      { id: "daily", title: "日常陪伴", kind: "space" }, { id: "ideas", title: "工作与灵感", kind: "space" }, { id: "project-neko", title: "NekoPapa", kind: "project" },
    ],
    items: [
      { id: "today", title: "今天的陪伴", kind: "conversation", groupId: "daily" }, { id: "night", title: "睡前聊聊", kind: "conversation", groupId: "daily" },
      { id: "weekend", title: "周末计划", kind: "page", groupId: "ideas" }, { id: "inspiration", title: "灵感收集", kind: "page", groupId: "ideas" },
      { id: "project-session", title: "桌面页面开发", kind: "coding", groupId: "project-neko" },
    ],
    tabs: ["home", "today", "weekend"], expanded: ["daily", "project-neko"],
  };
}

export function workspace(seed = sampleState()) { return new WorkspaceStore(storage(seed)); }

export function assertConsistent(store) {
  const state = store.state;
  assert.ok(state.tabs.length > 0);
  assert.equal(new Set(state.tabs).size, state.tabs.length);
  assert.ok(state.tabs.includes(state.activeId));
  assert.ok(navigationModes.includes(state.navigationMode));
  assert.equal(new Set(state.railOrder).size, navigationModes.length);
  assert.ok(state.railOrder.every((mode) => navigationModes.includes(mode)));
  assert.equal(store.history[store.historyIndex], state.activeId);
  assert.ok(store.history.every((id) => state.tabs.includes(id)));
  for (const [mode, id] of Object.entries(state.lastActive)) {
    assert.ok(state.tabs.includes(id));
    assert.equal(store.modeFor(id), mode);
  }
  for (const item of state.items) {
    const group = state.groups.find((group) => group.id === item.groupId);
    assert.ok(group);
    if (item.kind === "coding") assert.equal(group.kind, "project");
  }
  const archivedIds = state.archives.flatMap((record) => record.items.map((item) => item.id));
  assert.equal(new Set(archivedIds).size, archivedIds.length);
  assert.ok(archivedIds.every((id) => !store.item(id) && !state.tabs.includes(id)));
  assert.ok([...state.favorites, ...state.recent].every((id) => state.items.some((item) => item.id === id)));
  assert.ok(Object.values(state.groupContext).every((id) => state.groups.some((group) => group.id === id)));
}

