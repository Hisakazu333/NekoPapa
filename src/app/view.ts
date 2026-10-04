import { defaultPresentation, renderChrome, renderDetails } from "./chrome";
import { renderFeatureRail } from "./feature-view";
import type { ShellPresentation } from "./chrome";
import { escapeHtml, iconButton, itemIcon } from "./view-shared";
export { escapeHtml, iconButton, itemIcon, itemIcons } from "./view-shared";
import { icon } from "./icons";
import type { IconName } from "./icons";
import type { WorkspaceStore } from "./state";
import type { ArchiveRecord, NavigationMode, WorkspaceItem } from "./state";
import { unreadSessionCount } from "./activity";
import { renderSidebarBody, sidebarFooter, navigationLabels } from "./sidebar-view";
export { navigationLabels } from "./sidebar-view";

const appIconPath = "/brand/nekopapa-app-icon-v1-128.png";

const contentLabels: Partial<Record<WorkspaceItem["kind"], string>> = { conversation: "对话", coding: "Coding 会话", page: "笔记" };

function archiveRow(record: ArchiveRecord): string {
  const grouped = record.target === "group";
  const item = record.items[0];
  const title = grouped ? record.group?.title ?? "归档的分组" : item?.title ?? "归档的内容";
  const type = grouped ? record.group?.kind === "project" ? "项目" : "空间" : contentLabels[item?.kind ?? "page"] ?? "内容";
  const childTitles = record.items.map((entry) => entry.title).join("、");
  const origin = grouped ? `${record.items.length} 条内容${childTitles ? ` · ${childTitles}` : ""}` : record.group?.title ?? "原空间";
  const date = new Date(record.archivedAt);
  const dateLabel = date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  const searchText = `${title} ${record.group?.title ?? ""} ${type} ${childTitles}`.toLocaleLowerCase();
  const restoreLabel = `恢复${title}${grouped && record.items.length ? `及其 ${record.items.length} 条内容` : ""}`;
  return `<div class="archive-list-row" role="listitem" data-archive-entry="${escapeHtml(record.id)}" data-search-text="${escapeHtml(searchText)}"><div class="archive-list-main">${icon(grouped ? "folder" : item ? itemIcon(item) : "file")}<span class="archive-list-title">${escapeHtml(title)}</span></div><span class="archive-list-origin" title="${escapeHtml(origin)}">${escapeHtml(origin)}</span><span class="archive-list-kind">${type}</span><time class="archive-date" datetime="${escapeHtml(record.archivedAt)}" title="${escapeHtml(date.toLocaleString("zh-CN"))}">${escapeHtml(dateLabel)}</time><button class="archive-restore" type="button" data-action="restore-archive" data-id="${escapeHtml(record.id)}" data-focus="restore-archive-${escapeHtml(record.id)}" aria-label="${escapeHtml(restoreLabel)}" title="${escapeHtml(restoreLabel)}">恢复</button></div>`;
}

export function renderArchive(store: WorkspaceStore): string {
  const records = store.state.archives;
  return `<div class="archive-content"><p class="archive-description">暂时收起的对话、笔记和项目，随时可以恢复。</p>${records.length ? `<label class="archive-search">${icon("search")}<input type="search" data-archive-search data-focus="archive-search" aria-label="搜索归档" placeholder="搜索归档" autocomplete="off" /></label><div class="archive-section-heading"><h2>已归档</h2><span class="archive-total">${records.length} 项</span></div><div class="archive-list" role="list" aria-label="已归档内容">${records.map(archiveRow).join("")}</div><p class="archive-search-empty" data-archive-empty hidden>没有匹配的归档内容。</p>` : `<div class="archive-empty">${icon("archive")}<h2>还没有归档内容</h2><p>在内容或分组的操作菜单中选择「归档」，即可收起它们。</p></div>`}</div>`;
}

export function renderShell(store: WorkspaceStore, presentation: ShellPresentation = defaultPresentation()): string {
  const state = store.state;
  const active = store.item(state.activeId)!;
  const group = state.groups.find((entry) => entry.id === active.groupId);
  const unread = unreadSessionCount(state);
  const activityLabel = `${state.activityVisible ? "关闭" : "打开"}活动视图 (⌥⌘U)`;
  const railIcons: Record<NavigationMode, IconName> = { home: "home", chat: "message", library: "layers", tasks: "clock", tools: "tools", projects: "code" };
  const placeholder = (active.kind === "home" ? "从侧栏打开内容，或新建一个标签页。" : active.kind === "coding" ? "项目内容将在这里打开。" : active.kind === "conversation" || active.kind === "companion" ? "对话内容将在这里显示。" : "这里还是空的。");
  return `${renderChrome(store, presentation)}
  <nav class="icon-rail" aria-label="全局导航" >
    <div class="rail-top">
      ${state.railOrder.filter((id) => id !== "tasks" && id !== "tools").map((id) => `<button class="rail-button ${state.navigationMode === id ? "is-selected" : ""}" type="button" data-action="navigate" data-id="${id}" data-focus="rail-${id}" data-drag-kind="rail" data-drag-id="${id}" aria-label="${navigationLabels[id]}" aria-pressed="${state.navigationMode === id}" title="${navigationLabels[id]} · 拖动排序">${icon(railIcons[id], "", state.navigationMode === id ? "active" : "outline")}</button>`).join("")}
      ${renderFeatureRail(store)}
    </div>
    <div class="rail-bottom">
      <button class="rail-button" type="button" data-action="navigation-settings" data-focus="navigation-settings" aria-label="侧栏布局" aria-haspopup="menu" title="侧栏布局">${icon("layout")}</button>
      <button class="profile-button" type="button" data-action="account-menu" data-focus="rail-account" aria-label="账号，未登录" aria-haspopup="menu" aria-expanded="false" title="账号 · 未登录">${icon("user")}</button>
    </div>
  </nav>
  <aside class="sidebar" id="sidebar" aria-label="${state.activityVisible ? "会话活动" : navigationLabels[state.navigationMode]}侧栏" ${state.sidebarVisible ? "" : "inert"}>
    <div class="sidebar-header">
      <h2 class="sidebar-heading">${state.navigationMode === "home" ? `<img class="app-logo" src="${appIconPath}" width="18" height="18" alt="" draggable="false" />` : ""}<span class="sidebar-heading-text">${state.navigationMode === "home" ? "NekoPapa" : navigationLabels[state.navigationMode]}</span></h2>
      <div class="sidebar-header-actions"><button class="icon-button activity-toggle ${unread ? "has-unread" : ""}" type="button" data-action="toggle-activity" data-focus="activity-toggle" aria-label="${activityLabel}" title="${activityLabel}${unread ? ` · ${unread} 条未读` : ""}" aria-pressed="${state.activityVisible}" aria-controls="sidebar-content">${icon("bell")}${unread ? `<span class="sr-only">${unread} 条未读</span>` : ""}</button>${iconButton("search", "搜索 (⌘K)", "search")}</div>
    </div>
    <div class="sidebar-scroll" id="sidebar-content" data-navigation-mode="${state.navigationMode}" data-scroll-key="${state.activityVisible ? "activity" : state.navigationMode}">${renderSidebarBody(store)}</div>
    ${sidebarFooter(store)}
    <div class="sidebar-resizer" role="separator" data-focus="sidebar-resizer" aria-label="调整侧栏宽度" aria-orientation="vertical" aria-valuemin="196" aria-valuemax="320" aria-valuenow="${state.sidebarWidth}" tabindex="0" title="拖动调整宽度，双击恢复默认"></div>
  </aside>
  <main class="workspace" id="workspace" role="tabpanel" aria-labelledby="tab-${escapeHtml(active.id)}" tabindex="-1">
    <div class="content-surface">
    <div class="content-toolbar">
      <div class="breadcrumbs">${group && !active.id.startsWith("group:") ? `<span class="breadcrumb-parent">${icon("folder")}<span>${escapeHtml(group.title)}</span></span><span class="breadcrumb-slash">/</span>` : ""}<span class="breadcrumb-current">${escapeHtml(active.title)}</span></div>
      <span class="content-mode">${active.kind === "coding" ? "Coding" : active.kind === "conversation" || active.kind === "companion" ? "普通模式" : ""}</span>
    </div>
    <div class="content-placeholder"><span class="placeholder-mark">${active.kind === "home" ? `<img class="app-logo" src="${appIconPath}" width="64" height="64" alt="" draggable="false" />` : icon(itemIcon(active))}</span><h1>${escapeHtml(active.kind === "home" ? "NekoPapa" : active.title)}</h1><p>${placeholder}</p></div>
    ${store.recoveryData !== null ? '<div class="storage-notice" role="status"><span>读取历史数据时遇到问题，原始备份已保留。</span><button class="text-button" type="button" data-action="export-recovery" data-focus="export-recovery">导出原始备份</button></div>' : ""}
    ${!store.storageAvailable ? '<div class="storage-notice" role="status">当前无法保存工作台数据，重启后本次内容和导航变更可能丢失。</div>' : ""}
    </div>
    ${renderDetails(store, presentation)}
  </main>`;
}
