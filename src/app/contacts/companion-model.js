// Official NekoBuddy character profiles; lumia remains Mio's stored compatibility ID.
export const companionCatalog = [
    { id: "lumia", name: "白羽澪", description: "嘴硬照顾 · 主看板", avatar: "/characters/lumia-avatar.jpg" },
    { id: "rinne", name: "雪代凛音", description: "安静有序 · 说到做到", avatar: "/characters/rinne-avatar.webp" },
    { id: "iori", name: "花篠依織", description: "蔷薇茶会 · 优雅恶作剧" },
    { id: "shiori", name: "霧宮栞", description: "日记收纳 · 安静记录" },
    { id: "tsumugi", name: "黒羽紬", description: "行动派 · 小屋工坊" },
];
export const defaultCompanionId = "lumia";
export function companionById(id) {
    return companionCatalog.find((entry) => entry.id === id);
}
export function normalizeSelectedCompanion(value) {
    return typeof value === "string" ? companionById(value)?.id ?? defaultCompanionId : defaultCompanionId;
}
export function companionName(id) {
    return companionById(id)?.name ?? "未收录角色";
}
export function conversationForCompanion(state, id = state.selectedCompanionId) {
    const conversations = state.items.filter((item) => item.kind === "conversation" && item.companionId === id);
    return conversations.find((item) => item.id === state.activeId) ??
        state.recent.map((recent) => conversations.find((item) => item.id === recent)).find(Boolean) ??
        [...conversations].reverse().sort((a, b) => (Date.parse(b.activity?.updatedAt ?? "") || 0) - (Date.parse(a.activity?.updatedAt ?? "") || 0))[0];
}
