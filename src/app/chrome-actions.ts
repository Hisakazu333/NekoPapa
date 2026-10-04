import { chromeContext } from "./chrome";
import type { ShellActions } from "./content-actions";
import type { ShellOverlays } from "./overlays";
import type { WorkspaceStore } from "./state";

export function contentMenu(anchor: HTMLElement, store: WorkspaceStore, actions: ShellActions, overlays: ShellOverlays, render: () => void): void {
  const { item, managed, favorite } = chromeContext(store);
  const copy = async (value: string, name: string) => {
    try { await navigator.clipboard.writeText(value); actions.notify(`已复制${name}`); }
    catch { actions.notify("复制失败，请检查剪贴板权限"); }
  };
  const entries = managed ? [
    { label: "重命名", icon: "edit" as const, run: () => actions.rename(item.id, item.title) },
    { label: "移动到…", icon: "folder" as const, run: () => actions.moveItem(item.id) },
    { label: "在侧栏中定位", icon: "sidebar" as const, run: () => actions.locateItem(item.id) },
    { label: favorite ? "取消收藏" : "收藏", icon: "star" as const, run: () => { store.favorite(item.id); render(); } },
    ...actions.sessionMenuEntries(item),
    { label: "复制", icon: "layers" as const, separatorBefore: true, submenu: [
      { label: "复制名称", run: () => { void copy(item.title, "名称"); } },
      { label: item.kind === "page" ? "复制页面 ID" : "复制会话 ID", run: () => { void copy(item.id, item.kind === "page" ? "页面 ID" : "会话 ID"); } },
    ], run: () => {} },
    ...actions.lifecycle.menuEntries("item", item.id),
  ] : [
    { label: "新对话", icon: "message" as const, run: () => actions.newItem("conversation") },
    { label: "Coding 会话", icon: "code" as const, run: () => actions.newItem("coding") },
    { label: "新页面", icon: "file" as const, run: () => actions.newItem("page") },
    { label: "搜索已有内容…", icon: "search" as const, separatorBefore: true, run: () => actions.search() },
    { label: "设置", icon: "settings" as const, run: () => actions.settings.show() },
  ];
  overlays.menu(anchor, entries, managed ? item.title : "工作台操作");
}
