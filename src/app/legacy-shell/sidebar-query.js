export const sidebarListLimits = [5, 10, 20, 0];
export const defaultSidebarPreferences = () => ({ conversationScope: "all", listLimit: 10 });
export function normalizeSidebarPreferences(value, fallback = defaultSidebarPreferences()) {
    const saved = value && typeof value === "object" ? value : {};
    return {
        conversationScope: saved.conversationScope === "all" || saved.conversationScope === "selected" ? saved.conversationScope : fallback.conversationScope,
        listLimit: sidebarListLimits.includes(saved.listLimit) ? saved.listLimit : fallback.listLimit,
    };
}
// A display limit never removes content, reorders it or hides the current item.
export function sidebarSlice(items, limit, expanded, activeId, id) {
    if (expanded || !limit || items.length <= limit)
        return { visible: items, remaining: 0 };
    const activeIndex = items.findIndex((item) => id(item) === activeId);
    const visible = activeIndex >= limit ? [...items.slice(0, limit - 1), items[activeIndex]] : items.slice(0, limit);
    return { visible, remaining: items.length - visible.length };
}
