import { icon } from "./icons";
import { sessionStatusLabels } from "./activity";
import { escapeHtml, iconButton, itemIcon } from "./view-shared";
import { isSession } from "./state";
import type { WorkspaceStore, WorkspaceItem } from "./state";
import { companionName } from "./companion-model";

// Window presentation is temporary; full view never changes the saved sidebar layout.
export interface ShellPresentation { detailsVisible: boolean; fullView: boolean }
export const defaultPresentation = (): ShellPresentation => ({ detailsVisible: false, fullView: false });
const typeLabels = { conversation: "普通对话", coding: "Coding 会话", page: "页面", home: "工作台" };

export function chromeContext(store: WorkspaceStore) {
  const item = store.item(store.state.activeId)!;
  const group = store.state.groups.find((group) => group.id === item.groupId);
  return {
    item, group, managed: store.state.items.some((entry) => entry.id === item.id),
    type: typeLabels[item.kind as keyof typeof typeLabels] ?? "内容",
    favorite: store.state.favorites.includes(item.id),
    status: isSession(item) && item.activity?.status !== "idle" ? sessionStatusLabels[item.activity?.status ?? "idle"] : undefined,
    tabCount: store.state.tabs.length,
  };
}

function sessionIndicator(item: WorkspaceItem): string {
  const activity = item.activity;
  if (!activity) return "";
  const label = `${sessionStatusLabels[activity.status]}${activity.unread ? " · 有未读更新" : ""}`;
  if (["running", "waiting", "failed"].includes(activity.status)) return `<span class="session-indicator is-${activity.status}" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${activity.status === "running" ? "" : icon(activity.status === "waiting" ? "clock" : "close")}</span>`;
  return activity.unread ? '<span class="session-unread" role="img" aria-label="有未读更新"></span>' : "";
}

export function renderChrome(store: WorkspaceStore, presentation: ShellPresentation): string {
  const state = store.state, context = chromeContext(store);
  const sidebarVisible = state.sidebarVisible;
  const detailsVisible = presentation.detailsVisible && !presentation.fullView;
  return `<header class="window-chrome" aria-label="窗口顶部栏">
    <div class="chrome-navigation" data-tauri-drag-region>
      <div class="traffic-light-space" data-tauri-drag-region><div class="preview-traffic-lights" aria-hidden="true"><i></i><i></i><i></i></div></div>
      <div class="chrome-history" role="group" aria-label="历史导航">
        ${iconButton("left", "后退", "back", store.historyIndex === 0 ? "disabled" : "")}
        ${iconButton("right", "前进", "forward", store.historyIndex === store.history.length - 1 ? "disabled" : "")}
      </div><span class="chrome-divider" aria-hidden="true" data-tauri-drag-region></span>
      ${iconButton("sidebar", `${sidebarVisible ? "收起" : "展开"}侧栏 (⌘B)`, "toggle-sidebar", `aria-expanded="${sidebarVisible}" aria-controls="sidebar"`)}
      <div class="chrome-spacer" data-tauri-drag-region></div>
    </div>
    <div class="chrome-tabs" data-tauri-drag-region>
      <div class="tab-scroll" role="tablist" aria-label="已打开的标签页">
        ${state.tabs.map((id) => {
          const item = store.item(id)!, selected = id === state.activeId;
          const closeable = id !== "home" || state.tabs.length > 1;
          const parent = state.groups.find((entry) => entry.id === item.groupId);
          const label = parent ? `${item.title} · ${parent.title}` : item.title;
          return `<div class="workspace-tab ${selected ? "is-selected" : ""} ${closeable ? "has-close" : ""}" data-tab-id="${escapeHtml(id)}" data-context-tab="${escapeHtml(id)}" data-drag-kind="tab" data-drag-id="${escapeHtml(id)}">
            <button class="tab-target" role="tab" id="tab-${escapeHtml(id)}" aria-selected="${selected}" aria-controls="workspace" tabindex="${selected ? 0 : -1}" type="button" data-action="open" data-id="${escapeHtml(id)}" data-focus="tab-${escapeHtml(id)}" title="${escapeHtml(label)}">${icon(itemIcon(item))}<span class="tab-title">${escapeHtml(item.title)}</span>${sessionIndicator(item)}</button>
            ${closeable ? `<button class="tab-close" type="button" tabindex="${selected ? 0 : -1}" data-action="close-tab" data-id="${escapeHtml(id)}" data-focus="close-${escapeHtml(id)}" aria-label="关闭${escapeHtml(item.title)}" title="关闭标签页">${icon("close")}</button>` : ""}
          </div>`;
        }).join("")}
      </div>
      ${iconButton("plus", "新建标签页 (⌘T)", "new-tab", 'aria-haspopup="menu"', "chrome-create")}
      <div class="chrome-drag" data-tauri-drag-region></div>
      <div class="chrome-actions" role="group" aria-label="当前内容与窗口视图">
        ${iconButton("more", context.managed ? `${context.item.title}的操作` : "工作台操作", "content-menu", 'aria-haspopup="menu"')}
        ${iconButton("details", `${detailsVisible ? "关闭" : "打开"}内容详情`, "toggle-details", `aria-expanded="${detailsVisible}" aria-controls="content-details"`)}
        <span class="chrome-action-divider" aria-hidden="true"></span>
        ${iconButton(presentation.fullView ? "contract" : "expand", `${presentation.fullView ? "退出" : "进入"}完整视图`, "toggle-full-view", `aria-pressed="${presentation.fullView}" ${!presentation.fullView && !presentation.detailsVisible ? "disabled" : ""}`)}
        <button class="icon-button chrome-tab-count" type="button" data-action="tab-overflow" data-focus="tab-overflow" aria-haspopup="menu" aria-label="打开的标签页，${context.tabCount} 个" title="打开的标签页，${context.tabCount} 个"><span aria-hidden="true">${context.tabCount}</span></button>
      </div>
    </div>
  </header>`;
}

export function renderDetails(store: WorkspaceStore, presentation: ShellPresentation): string {
  const { item, group, type, managed, favorite, status } = chromeContext(store);
  const visible = presentation.detailsVisible && !presentation.fullView;
  const row = (label: string, value: string) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  const updatedAt = isSession(item) && item.activity?.updatedAt;
  const details = managed ? `${row("类型", type)}${row(group?.kind === "project" ? "项目" : "空间", group?.title ?? "未分组")}${item.kind === "conversation" ? row("陪伴角色", companionName(item.companionId)) : ""}${row("收藏", favorite ? "已收藏" : "未收藏")}${isSession(item) ? row("置顶", item.activity?.pinned ? "已置顶" : "未置顶") : ""}${status ? row("会话状态", status) : ""}${updatedAt ? row("更新时间", new Date(updatedAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })) : ""}` :
    `${row("空间", String(store.state.groups.filter((group) => group.kind === "space").length))}${row("项目", String(store.state.groups.filter((group) => group.kind === "project").length))}${row("对话", String(store.state.items.filter(isSession).length))}${row("页面", String(store.state.items.filter((item) => item.kind === "page").length))}${row("归档", String(store.state.archives.length))}`;
  return `<aside class="content-details" id="content-details" aria-label="内容详情" ${visible ? "" : "hidden"}>
    <div class="details-heading"><span>内容详情</span>${iconButton("close", "关闭内容详情", "toggle-details", "", "close-details")}</div>
    <div class="details-card"><div class="details-title">${icon(itemIcon(item))}<h2>${escapeHtml(managed ? item.title : "NekoPapa")}</h2></div>
      ${!managed && !store.state.items.length && !store.state.groups.length ? '<p class="details-empty">还没有内容。新建对话、页面或项目后，可以在这里查看详情。</p>' : ""}
      <dl class="details-properties">${details}</dl>
      ${managed ? `<div class="details-footer"><span>${store.storageAvailable ? "信息保存在本机" : "本次更改尚未保存"}</span></div>` : ""}
    </div>
  </aside>`;
}
