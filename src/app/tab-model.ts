import { companionName } from "./companion-model";
import type { ShellState, WorkspaceItem } from "./workspace-model";

export interface OpenedTabEntry {
  item: WorkspaceItem;
  description: string;
  active: boolean;
  closeable: boolean;
}

export function openedTabEntries(state: Pick<ShellState, "tabs" | "activeId" | "items" | "groups">, query = ""): OpenedTabEntry[] {
  const items = new Map(state.items.map((item) => [item.id, item]));
  const groups = new Map(state.groups.map((group) => [group.id, group.title]));
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return state.tabs.flatMap((id) => {
    const item: WorkspaceItem | undefined = id === "home" ? { id, title: "首页", kind: "home" } : items.get(id);
    if (!item) return [];
    const type = item.kind === "conversation" ? "普通对话" : item.kind === "coding" ? "Coding 会话" : item.kind === "page" ? "页面" : "工作台";
    const description = [item.groupId ? groups.get(item.groupId) : undefined, item.kind === "conversation" ? companionName(item.companionId) : undefined, type].filter(Boolean).join(" · ");
    const text = `${item.title} ${description} ${id}`.toLocaleLowerCase();
    return terms.every((term) => text.includes(term)) ? [{ item, description, active: id === state.activeId, closeable: id !== "home" || state.tabs.length > 1 }] : [];
  });
}
