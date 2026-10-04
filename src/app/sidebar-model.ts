import { activitySections } from "./activity";
import type { ShellState, WorkspaceItem } from "./workspace-model";

// Workbench shortcuts are references to user content; folders live in their own indexes.
export function workbenchEntries(state: Pick<ShellState, "items" | "favorites" | "recent">): { favorites: WorkspaceItem[]; recent: WorkspaceItem[] } {
  const items = new Map(state.items.map((item) => [item.id, item]));
  const resolve = (ids: string[]) => ids.flatMap((id) => items.has(id) ? [items.get(id)!] : []);
  return {
    favorites: resolve(state.favorites),
    recent: resolve(state.recent.filter((id) => !state.favorites.includes(id))),
  };
}

export function conversationSections(state: Pick<ShellState, "items" | "groups" | "recent" | "activityFilter">, now = new Date()) {
  return activitySections({ ...state, items: state.items.filter((item) => item.kind === "conversation"), activityFilter: "all" }, now)
    .filter((section) => section.entries.length)
    .map((section) => ({ ...section, id: `chat-${section.id}`, title: section.id === "activity-priority" ? "置顶与关注" : section.title }));
}
