import { defaultPresentation, renderChrome, renderDetails } from "./chrome";
import { renderGlobalRail } from "./rail-view";
import { renderSettingsShell } from "./settings-view";
import type { SettingsNavigation } from "./settings-model";
import type { ConfigurationView } from "./configuration-types";
import type { ShellPresentation } from "./chrome";
import { escapeHtml, iconButton, itemIcon } from "./view-shared";
export { escapeHtml, iconButton, itemIcon, itemIcons } from "./view-shared";
import { icon } from "./icons";
import type { WorkspaceStore } from "./state";
import { unreadSessionCount } from "./activity";
import { renderSidebarBody, sidebarFooter, navigationLabels } from "./sidebar-view";
export { navigationLabels } from "./sidebar-view";

const appIconPath = "/brand/nekopapa-app-icon-v1-128.png";

export function renderShell(store: WorkspaceStore, presentation: ShellPresentation = defaultPresentation(), expandedLists: ReadonlySet<string> = new Set(), settings?: SettingsNavigation, configuration?: ConfigurationView): string {
  if (settings?.open && configuration) return renderSettingsShell(store, settings, configuration);
  const state = store.state;
  const active = store.item(state.activeId)!;
  const group = state.groups.find((entry) => entry.id === active.groupId);
  const unread = unreadSessionCount(state);
  const activityLabel = `${state.activityVisible ? "关闭" : "打开"}活动视图 (⌥⌘U)`;
  const placeholder = (active.kind === "home" ? "从侧栏打开内容，或新建一个标签页。" : active.kind === "coding" ? "项目内容将在这里打开。" : active.kind === "conversation" || active.kind === "companion" ? "对话内容将在这里显示。" : "这里还是空的。");
  return `${renderChrome(store, presentation)}
  ${renderGlobalRail(store)}
  <aside class="sidebar" id="sidebar" aria-label="${state.activityVisible ? "会话活动" : navigationLabels[state.navigationMode]}侧栏" ${state.sidebarVisible ? "" : "inert"}>
    <div class="sidebar-header">
      <h2 class="sidebar-heading">${state.navigationMode === "home" ? `<img class="app-logo" src="${appIconPath}" width="18" height="18" alt="" draggable="false" />` : ""}<span class="sidebar-heading-text">${state.navigationMode === "home" ? "NekoPapa" : navigationLabels[state.navigationMode]}</span></h2>
      <div class="sidebar-header-actions">
        ${!state.activityVisible && state.navigationMode !== "chat" ? iconButton("more", "侧栏列表选项", "sidebar-options", 'aria-haspopup="menu"') : ""}
        <button class="icon-button activity-toggle ${unread ? "has-unread" : ""}" type="button" data-action="toggle-activity" data-focus="activity-toggle" aria-label="${activityLabel}" title="${activityLabel}${unread ? ` · ${unread} 条未读` : ""}" aria-pressed="${state.activityVisible}" aria-controls="sidebar-content">${icon("bell")}${unread ? `<span class="sr-only">${unread} 条未读</span>` : ""}</button>${iconButton("search", "搜索 (⌘K)", "search")}
      </div>
    </div>
    <div class="sidebar-scroll" id="sidebar-content" data-navigation-mode="${state.navigationMode}" data-scroll-key="${state.activityVisible ? "activity" : state.navigationMode}">${renderSidebarBody(store, expandedLists)}</div>
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
