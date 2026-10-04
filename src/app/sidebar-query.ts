export type SidebarListLimit = 5 | 10 | 20 | 0;
export interface SidebarPreferences {
  conversationScope: "all" | "selected";
  listLimit: SidebarListLimit;
}

export const sidebarListLimits: SidebarListLimit[] = [5, 10, 20, 0];
export const defaultSidebarPreferences = (): SidebarPreferences => ({ conversationScope: "all", listLimit: 10 });

export function normalizeSidebarPreferences(value: unknown, fallback = defaultSidebarPreferences()): SidebarPreferences {
  const saved = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    conversationScope: saved.conversationScope === "all" || saved.conversationScope === "selected" ? saved.conversationScope : fallback.conversationScope,
    listLimit: sidebarListLimits.includes(saved.listLimit as SidebarListLimit) ? saved.listLimit as SidebarListLimit : fallback.listLimit,
  };
}

// A display limit never removes content, reorders it or hides the current item.
export function sidebarSlice<T>(items: T[], limit: SidebarListLimit, expanded: boolean, activeId: string, id: (item: T) => string): { visible: T[]; remaining: number } {
  if (expanded || !limit || items.length <= limit) return { visible: items, remaining: 0 };
  const activeIndex = items.findIndex((item) => id(item) === activeId);
  const visible = activeIndex >= limit ? [...items.slice(0, limit - 1), items[activeIndex]] : items.slice(0, limit);
  return { visible, remaining: items.length - visible.length };
}
