import { icon } from "./icons";
import type { IconName } from "./icons";
import { systemItems, WorkspaceStore } from "./state";
import type { WorkspaceGroup, WorkspaceItem } from "./state";

const appIconPath = "/brand/nekopapa-app-icon-v1-128.png";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export const itemIcons: Record<WorkspaceItem["kind"], IconName> = {
  home: "home", conversation: "message", coding: "code", page: "file", companion: "cat", memory: "book", workflow: "workflow", tasks: "clock", settings: "settings", connections: "link",
};

export function iconButton(name: IconName, label: string, action: string, attributes = ""): string {
  return `<button class="icon-button" type="button" data-action="${action}" data-focus="${action}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${attributes}>${icon(name)}</button>`;
}

function itemRow(item: WorkspaceItem, store: WorkspaceStore, nested = false): string {
  const active = store.state.activeId === item.id;
  return `<div class="navigation-row ${active ? "is-active" : ""} ${nested ? "is-nested" : ""}" data-context-id="${escapeHtml(item.id)}">
    <button class="row-main" type="button" data-action="open" data-id="${escapeHtml(item.id)}" data-focus="open-${escapeHtml(item.id)}" ${active ? 'aria-current="page"' : ""} title="${escapeHtml(item.title)}">
      ${icon(itemIcons[item.kind])}<span class="row-title">${escapeHtml(item.title)}</span>
    </button>
    ${!systemItems.some((entry) => entry.id === item.id) ? `<button class="row-more" type="button" data-action="item-menu" data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title)}的操作" title="更多操作">${icon("more")}</button>` : ""}
  </div>`;
}

function groupRows(group: WorkspaceGroup, store: WorkspaceStore): string {
  const expanded = store.state.expanded.includes(group.id);
  const items = store.state.items.filter((item) => item.groupId === group.id);
  const activeGroup = items.some((item) => item.id === store.state.activeId);
  return `<div class="navigation-group" data-context-id="${escapeHtml(group.id)}">
    <div class="navigation-row group-row ${activeGroup && !expanded ? "has-active-child" : ""}">
      <button class="row-main" type="button" data-action="toggle-group" data-id="${escapeHtml(group.id)}" data-focus="group-${escapeHtml(group.id)}" aria-expanded="${expanded}" aria-controls="children-${escapeHtml(group.id)}">
        ${icon(expanded ? "folderOpen" : "folder")}<span class="row-title">${escapeHtml(group.title)}</span>${icon("right", `disclosure ${expanded ? "is-expanded" : ""}`)}
      </button>
      <button class="row-more" type="button" data-action="group-menu" data-id="${escapeHtml(group.id)}" aria-label="${escapeHtml(group.title)}的操作" title="更多操作">${icon("more")}</button>
    </div>
    <div class="group-children" id="children-${escapeHtml(group.id)}" ${expanded ? "" : "hidden"}>
      ${items.length ? items.map((item) => itemRow(item, store, true)).join("") : '<span class="empty-group">暂无内容</span>'}
    </div>
  </div>`;
}

function section(title: string, kind: WorkspaceGroup["kind"], store: WorkspaceStore): string {
  return `<section class="sidebar-section" aria-label="${title}">
    <div class="section-heading"><span>${title}</span><button class="section-add" type="button" data-action="add-group" data-kind="${kind}" aria-label="添加${title === "空间" ? "空间" : "项目"}" title="添加${title}">${icon("plus")}</button></div>
    ${store.state.groups.filter((group) => group.kind === kind).map((group) => groupRows(group, store)).join("")}
  </section>`;
}

export function renderShell(store: WorkspaceStore): string {
  const state = store.state;
  const active = store.item(state.activeId)!;
  const group = state.groups.find((entry) => entry.id === active.groupId);
  const recentExpanded = state.expanded.includes("recent-section");
  const railItems: Array<{ id: string; icon: IconName; label: string }> = [
    { id: "home", icon: "home", label: "首页" },
    { id: "lumia", icon: "cat", label: "陪伴" },
    { id: "tasks", icon: "clock", label: "任务" },
    { id: "workflows", icon: "workflow", label: "工作流" },
  ];
  const railActive = active.kind === "conversation" || active.kind === "companion" ? "lumia" : active.kind === "workflow" ? "workflows" : active.id;
  const placeholder = active.kind === "home" ? "从侧栏打开内容，或新建一个标签页。" : active.kind === "coding" ? "项目内容将在这里打开。" : active.kind === "conversation" || active.kind === "companion" ? "对话内容将在这里显示。" : "这里还是空的。";
  return `<header class="window-chrome" aria-label="窗口顶部栏">
    <div class="chrome-navigation" data-tauri-drag-region>
      <div class="traffic-light-space" data-tauri-drag-region><div class="preview-traffic-lights" aria-hidden="true"><i></i><i></i><i></i></div></div>
      ${iconButton("left", "后退", "back", store.historyIndex === 0 ? "disabled" : "")}
      ${iconButton("right", "前进", "forward", store.historyIndex === store.history.length - 1 ? "disabled" : "")}
      ${iconButton("sidebar", `${state.sidebarVisible ? "收起" : "展开"}侧栏 (⌘B)`, "toggle-sidebar", `aria-expanded="${state.sidebarVisible}" aria-controls="sidebar"`)}
      <div class="chrome-spacer" data-tauri-drag-region></div>
    </div>
    <div class="chrome-tabs" data-tauri-drag-region>
      <div class="tab-scroll" role="tablist" aria-label="已打开的标签页">
        ${state.tabs.map((id) => {
          const item = store.item(id)!;
          const selected = id === state.activeId;
          return `<div class="workspace-tab ${selected ? "is-selected" : ""}" data-tab-id="${escapeHtml(id)}" data-context-tab="${escapeHtml(id)}">
            <button class="tab-target" role="tab" id="tab-${escapeHtml(id)}" aria-selected="${selected}" aria-controls="workspace" tabindex="${selected ? 0 : -1}" type="button" data-action="open" data-id="${escapeHtml(id)}" data-focus="tab-${escapeHtml(id)}" title="${escapeHtml(item.title)}">
              ${icon(itemIcons[item.kind])}<span class="tab-title">${escapeHtml(item.title)}</span>
            </button>
            <button class="tab-close" type="button" data-action="close-tab" data-id="${escapeHtml(id)}" aria-label="关闭${escapeHtml(item.title)}" title="关闭标签页">${icon("close")}</button>
          </div>`;
        }).join("")}
      </div>
      ${iconButton("plus", "新建标签页 (⌘T)", "new-tab")}
      ${iconButton("down", "切换标签页", "tab-overflow", "hidden")}
      <div class="chrome-drag" data-tauri-drag-region></div>
    </div>
  </header>
  <nav class="icon-rail" aria-label="全局导航">
    <div class="rail-top">
      ${railItems.map((entry) => `<button class="rail-button ${railActive === entry.id ? "is-selected" : ""}" type="button" data-action="open" data-id="${entry.id}" data-focus="rail-${entry.id}" aria-label="${entry.label}" ${railActive === entry.id ? 'aria-current="page"' : ""} title="${entry.label}">${icon(entry.icon)}</button>`).join("")}
      <button class="rail-button" type="button" data-action="rail-menu" aria-label="更多导航" title="更多">${icon("more")}</button>
      <div class="rail-separator"></div>
      <button class="rail-button ${active.kind === "coding" ? "is-selected" : ""}" type="button" data-action="open-project" aria-label="代码项目" title="代码项目">${icon("code")}</button>
      <button class="rail-button ${active.kind === "connections" ? "is-selected" : ""}" type="button" data-action="open" data-id="connections" aria-label="连接器" title="连接器">${icon("link")}</button>
    </div>
    <div class="rail-bottom">
      <button class="rail-button ${active.id === "settings" ? "is-selected" : ""}" type="button" data-action="open" data-id="settings" aria-label="设置" title="设置">${icon("settings")}</button>
      <button class="profile-button" type="button" data-action="workspace-menu" aria-label="本地工作台" title="本地工作台">N</button>
    </div>
  </nav>
  <aside class="sidebar" id="sidebar" aria-label="工作台侧栏" ${state.sidebarVisible ? "" : "inert"}>
    <div class="sidebar-header">
      <button class="workspace-switcher" type="button" data-action="workspace-menu" aria-label="NekoPapa 工作台菜单"><img class="app-logo" src="${appIconPath}" width="20" height="20" alt="" draggable="false" /><span class="workspace-title">NekoPapa</span>${icon("down")}</button>
      <div class="sidebar-header-actions">${iconButton("bell", "通知", "notifications")}${iconButton("search", "搜索 (⌘K)", "search")}</div>
    </div>
    <div class="sidebar-scroll">
      <div class="sidebar-quick-actions">
        <button class="quick-action" type="button" data-action="new-conversation" data-focus="new-conversation">${icon("edit")}<span>新聊天</span></button>
        ${itemRow(systemItems[1], store)}
      </div>
      ${state.favorites.length ? `<section class="sidebar-section" aria-label="收藏"><div class="section-heading"><span>收藏</span></div>${state.favorites.map((id) => itemRow(store.item(id)!, store)).join("")}</section>` : ""}
      ${section("空间", "space", store)}
      ${section("项目", "project", store)}
      <div class="sidebar-library">${itemRow(systemItems[3], store)}${itemRow(systemItems[4], store)}</div>
      <section class="sidebar-section recent-section" aria-label="最近访问">
        <button class="section-heading section-toggle" type="button" data-action="toggle-group" data-id="recent-section" data-focus="group-recent-section" aria-expanded="${recentExpanded}"><span>最近</span>${icon("right", `disclosure ${recentExpanded ? "is-expanded" : ""}`)}</button>
        <div ${recentExpanded ? "" : "hidden"}>${state.recent.length ? state.recent.slice(0, 5).map((id) => itemRow(store.item(id)!, store)).join("") : '<p class="recent-empty">打开的内容会显示在这里</p>'}</div>
      </section>
    </div>
    <div class="sidebar-resizer" role="separator" data-focus="sidebar-resizer" aria-label="调整侧栏宽度" aria-orientation="vertical" aria-valuemin="196" aria-valuemax="320" aria-valuenow="${state.sidebarWidth}" tabindex="0" title="拖动调整宽度，双击恢复默认"></div>
  </aside>
  <main class="workspace" id="workspace" role="tabpanel" aria-labelledby="tab-${escapeHtml(active.id)}" tabindex="-1">
    <div class="content-toolbar">
      <div class="breadcrumbs">${group ? `<span class="breadcrumb-parent">${icon("folder")}<span>${escapeHtml(group.title)}</span></span><span class="breadcrumb-slash">/</span>` : ""}<span class="breadcrumb-current">${escapeHtml(active.title)}</span></div>
      <span class="content-mode">${active.kind === "coding" ? "Coding" : active.kind === "conversation" || active.kind === "companion" ? "普通模式" : ""}</span>
    </div>
    <div class="content-placeholder"><span class="placeholder-mark">${active.kind === "home" ? `<img class="app-logo" src="${appIconPath}" width="64" height="64" alt="" draggable="false" />` : icon(itemIcons[active.kind])}</span><h1>${escapeHtml(active.kind === "home" ? "NekoPapa" : active.title)}</h1><p>${placeholder}</p></div>
    ${!store.storageAvailable ? '<div class="storage-notice" role="status">当前无法保存布局，重启后这些导航变更可能丢失。</div>' : ""}
  </main>`;
}
