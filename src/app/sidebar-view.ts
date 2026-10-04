import { icon } from "./icons";
import { escapeHtml, iconButton, itemIcon } from "./view-shared";
import { sidebarCreationKind } from "./state";
import type { WorkspaceStore, NavigationMode, WorkspaceGroup, WorkspaceItem } from "./state";
import { activitySections, sessionStatusLabels } from "./activity";
import type { ActivityEntry } from "./activity";
import { conversationSections, workbenchEntries } from "./sidebar-model";
import { renderCompanionEntry } from "./companion-view";
import { companionName } from "./companion-model";
import { sidebarSlice } from "./sidebar-query";

function listRows<T>(items: T[], key: string, store: WorkspaceStore, expandedLists: ReadonlySet<string>, id: (entry: T) => string, render: (entry: T) => string): string {
  const limit = store.state.sidebarPreferences.listLimit;
  const expanded = expandedLists.has(key);
  const { visible, remaining } = sidebarSlice(items, limit, expanded, store.state.activeId, id);
  const more = limit && items.length > limit ? `<button class="sidebar-list-more" type="button" data-action="sidebar-list-more" data-id="${escapeHtml(key)}" data-focus="list-${escapeHtml(key)}" aria-expanded="${expanded}">${icon(expanded ? "up" : "down")}<span>${expanded ? "收起列表" : `显示其余 ${remaining} 项`}</span></button>` : "";
  return visible.map(render).join("") + more;
}

function itemRow(item: WorkspaceItem, store: WorkspaceStore, nested = false, placement = nested ? "group" : "shortcut"): string {
  const active = store.state.activeId === item.id;
  const focus = `${placement}-${escapeHtml(item.id)}`;
  const managed = store.state.items.some((entry) => entry.id === item.id);
  const source = placement === "recent" || (placement === "favorite" && store.state.navigationMode === "home") ? store.state.groups.find((group) => group.id === item.groupId)?.title : undefined;
  const drag = managed && (nested || placement === "favorite") ? `data-drag-kind="${placement === "favorite" ? "favorite" : "item"}" data-drag-id="${escapeHtml(item.id)}" data-drag-group="${escapeHtml(item.groupId ?? "")}"` : "";
  return `<div class="navigation-row ${active ? "is-active" : ""} ${nested ? "is-nested" : ""} ${managed ? "has-menu" : ""}" data-context-id="${escapeHtml(item.id)}" ${drag}>
    <button class="row-main" type="button" data-action="open" data-id="${escapeHtml(item.id)}" data-focus="open-${focus}" ${active ? 'aria-current="page"' : ""} title="${escapeHtml(item.title)}">
      ${icon(itemIcon(item))}<span class="row-title">${escapeHtml(item.title)}</span>${source ? `<span class="row-source" title="${escapeHtml(source)}">${escapeHtml(source)}</span>` : ""}
    </button>
    ${managed ? `<button class="row-more" type="button" data-action="item-menu" data-id="${escapeHtml(item.id)}" data-focus="menu-${focus}" aria-label="${escapeHtml(item.title)}的操作" aria-haspopup="menu" title="更多操作">${icon("more")}</button>` : ""}
  </div>`;
}

function groupRows(group: WorkspaceGroup, store: WorkspaceStore, expandedLists: ReadonlySet<string>): string {
  const items = store.state.items.filter((item) => item.groupId === group.id);
  const expanded = store.state.expanded.includes(group.id);
  const active = store.state.groupContext[store.state.navigationMode] === group.id;
  const activeChild = items.some((item) => item.id === store.state.activeId);
  return `<div class="navigation-group" data-context-id="${escapeHtml(group.id)}">
    <div class="navigation-row group-row ${active ? "is-group-context" : ""} ${activeChild && !expanded ? "has-active-child" : ""}" data-drag-kind="group" data-drag-id="${escapeHtml(group.id)}" data-drag-group="${escapeHtml(group.id)}">
      <button class="group-disclosure" type="button" data-action="toggle-group" data-id="${escapeHtml(group.id)}" data-focus="toggle-group-${escapeHtml(group.id)}" aria-label="${expanded ? "收起" : "展开"}${escapeHtml(group.title)}" aria-expanded="${expanded}" aria-controls="children-${escapeHtml(group.id)}">${icon("right", `disclosure ${expanded ? "is-expanded" : ""}`)}</button>
      <button class="row-main" type="button" data-action="locate-group" data-id="${escapeHtml(group.id)}" data-focus="group-${escapeHtml(group.id)}" aria-pressed="${active}" title="选择${escapeHtml(group.title)}作为新建位置">
        ${icon(expanded ? "folderOpen" : "folder")}<span class="row-title">${escapeHtml(group.title)}</span><span class="group-count" aria-hidden="true">${items.length}</span>
      </button>
      <button class="row-more" type="button" data-action="group-menu" data-id="${escapeHtml(group.id)}" data-focus="menu-group-${escapeHtml(group.id)}" aria-label="${escapeHtml(group.title)}的操作" aria-haspopup="menu" title="更多操作">${icon("more")}</button>
    </div>
    <div class="group-children" id="children-${escapeHtml(group.id)}" data-drop-kind="group-content" data-drop-group="${escapeHtml(group.id)}" ${expanded ? "" : "hidden"}>
      ${items.length ? listRows(items, `group-${group.id}`, store, expandedLists, (item) => item.id, (item) => itemRow(item, store, true)) : `<button class="empty-group" type="button" data-action="create-in-group" data-id="${escapeHtml(group.id)}" data-kind="${group.kind === "project" ? "coding" : "page"}" data-focus="create-group-${escapeHtml(group.id)}">${icon("plus")}<span>${group.kind === "project" ? "新 Coding 会话" : "新页面"}</span></button>`}
    </div>
  </div>`;
}

function section(id: string, title: string, contents: string, store: WorkspaceStore, kind?: WorkspaceGroup["kind"], actions = ""): string {
  const expanded = !store.state.collapsedSections.includes(id);
  return `<section class="sidebar-section" aria-label="${escapeHtml(title)}">
    <div class="section-heading">
      <button class="section-toggle" type="button" data-action="toggle-section" data-id="${id}" data-focus="section-${id}" aria-expanded="${expanded}" aria-controls="section-${id}-contents"><span>${escapeHtml(title)}</span>${icon("right", `disclosure ${expanded ? "is-expanded" : ""}`)}</button>
      ${actions}
      ${kind ? `<button class="section-add" type="button" data-action="add-group" data-kind="${kind}" data-focus="add-${id}" aria-label="添加${kind === "space" ? "空间" : "项目"}" title="添加${kind === "space" ? "空间" : "项目"}">${icon("plus")}</button>` : ""}
    </div>
    <div class="section-contents" id="section-${id}-contents" ${expanded ? "" : "hidden"}>${contents}</div>
  </section>`;
}

export const navigationLabels: Record<NavigationMode, string> = { home: "工作台", chat: "对话", library: "空间", projects: "项目", tasks: "任务", tools: "工具" };

function favorites(store: WorkspaceStore, expandedLists: ReadonlySet<string>): string {
  const items = workbenchEntries(store.state).favorites;
  const key = `${store.state.navigationMode}-favorites`;
  return items.length ? section(key, "收藏", listRows(items, key, store, expandedLists, (item) => item.id, (item) => itemRow(item, store, false, "favorite")), store) : "";
}

function sessionIndicator(item: WorkspaceItem): string {
  const activity = item.activity;
  if (!activity) return "";
  if (activity.status === "running" || activity.status === "waiting" || activity.status === "failed") {
    const label = `${sessionStatusLabels[activity.status]}${activity.unread ? " · 有未读更新" : ""}`;
    return `<span class="session-indicator is-${activity.status}" role="img" aria-label="${label}" title="${label}">${activity.status === "running" ? "" : icon(activity.status === "waiting" ? "clock" : "close")}</span>`;
  }
  if (activity.unread) return '<span class="session-indicator is-unread" role="img" aria-label="未读" title="未读"></span>';
  if (activity.pinned) return `<span class="session-indicator is-pinned" role="img" aria-label="已置顶" title="已置顶">${icon("pin")}</span>`;
  return "";
}

function activityRow({ item, source }: ActivityEntry, store: WorkspaceStore, compact = false): string {
  const active = item.id === store.state.activeId;
  const summary = item.activity?.summary;
  const status = item.activity ? sessionStatusLabels[item.activity.status] : "";
  const character = item.kind === "conversation" ? companionName(item.companionId) : undefined;
  const sourceLabel = compact ? character : source?.title;
  const date = item.activity?.updatedAt ? new Date(item.activity.updatedAt).toLocaleString("zh-CN") : "未记录活动时间";
  const label = [item.title, character, source?.title, item.kind === "coding" ? "Coding 会话" : "普通对话", status, item.activity?.unread ? "未读" : ""].filter(Boolean).join(" · ");
  return `<div class="activity-row ${compact ? "is-compact" : ""} ${active ? "is-active" : ""} ${item.activity?.unread ? "is-unread" : ""}" data-context-id="${escapeHtml(item.id)}" data-activity-id="${escapeHtml(item.id)}">
    <button class="activity-open" type="button" data-action="open" data-id="${escapeHtml(item.id)}" data-focus="open-activity-${escapeHtml(item.id)}" aria-label="${escapeHtml(label)}" ${active ? 'aria-current="page"' : ""} title="${escapeHtml(`${label}\n${summary ?? "尚无消息摘要"}\n${date}`)}">
      <span class="activity-title-line">${compact ? icon("message") : ""}<span class="activity-title">${escapeHtml(item.title)}</span>${sourceLabel ? `<span class="activity-source">${escapeHtml(sourceLabel)}</span>` : ""}</span>
      ${!compact || summary ? `<span class="activity-preview ${summary ? "" : "is-empty"}">${escapeHtml(summary ?? (status || (item.kind === "coding" ? "尚无执行记录" : "尚无消息摘要")))}</span>` : ""}
      ${sessionIndicator(item)}
    </button>
    <button class="row-more" type="button" data-action="item-menu" data-id="${escapeHtml(item.id)}" data-focus="menu-activity-${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title)}的操作" aria-haspopup="menu" title="更多操作">${icon("more")}</button>
  </div>`;
}

function renderActivity(store: WorkspaceStore, expandedLists: ReadonlySet<string>): string {
  const sections = activitySections(store.state);
  const count = sections.reduce((sum, section) => sum + section.entries.length, 0);
  const unread = store.state.activityFilter === "unread";
  const options = iconButton("more", "活动视图选项", "activity-options", 'aria-haspopup="menu"');
  const list = sections.filter((entry) => entry.id === "activity-priority" || entry.entries.length).map((entry) => section(entry.id, entry.title,
    entry.entries.length ? listRows(entry.entries, entry.id, store, expandedLists, (entry) => entry.item.id, (entry) => activityRow(entry, store)) : '<p class="section-empty">置顶和需要关注的会话会出现在这里</p>', store)).join("");
  return `<div class="sidebar-shortcuts">${renderCompanionEntry(store)}</div>
    <div class="activity-toolbar"><span>${unread ? "未读会话" : "会话活动"}<span class="activity-total">${count}</span></span>${options}</div>
    ${count ? list : `<div class="activity-empty"><span>${unread ? "没有未读会话" : "还没有会话"}</span><p>${unread ? "新的会话更新会出现在这里。" : "新建对话或 Coding 会话后，即可在这里查看。"}</p>${unread ? '<button class="text-button" type="button" data-action="activity-all" data-focus="activity-show-all">显示全部会话</button>' : ""}</div>`}`;
}

export function renderSidebarBody(store: WorkspaceStore, expandedLists: ReadonlySet<string> = new Set()): string {
  if (store.state.activityVisible) return renderActivity(store, expandedLists);
  const { navigationMode: mode, groups } = store.state;
  const empty = (title: string, hint: string) => `<div class="category-empty"><p>${title}</p><span>${hint}</span></div>`;
  const allGroups = (kind: WorkspaceGroup["kind"]) => groups.filter((group) => group.kind === kind).map((group) => groupRows(group, store, expandedLists)).join("");
  if (mode === "home") {
    const entries = workbenchEntries(store.state);
    const recentItems = listRows(entries.recent, "home-recent", store, expandedLists, (item) => item.id, (item) => itemRow(item, store, false, "recent"));
    return `<div class="sidebar-shortcuts">${renderCompanionEntry(store)}</div>
      ${favorites(store, expandedLists)}
      ${recentItems ? section("home-recent", "最近访问", recentItems, store) : ""}
      ${!entries.favorites.length && !entries.recent.length ? `<div class="workbench-empty"><p>${store.state.items.length ? "还没有最近访问" : "从一次对话开始"}</p><span>${store.state.items.length ? "从左侧打开空间或项目，继续已有内容。" : "选择陪伴角色，点击开始对话或下方新对话。"}</span></div>` : ""}`;
  }
  if (mode === "chat") {
    const sections = conversationSections(store.state);
    const selected = store.state.sidebarPreferences.conversationScope === "selected";
    const name = companionName(store.state.selectedCompanionId);
    const count = sections.reduce((total, entry) => total + entry.entries.length, 0);
    const toolbar = `<div class="conversation-toolbar"><button type="button" class="conversation-scope" data-action="sidebar-options" data-focus="sidebar-options" aria-haspopup="menu" aria-label="侧栏列表选项，${selected ? `仅${escapeHtml(name)}` : "全部人物"}"><span>${selected ? escapeHtml(name) : "全部人物"}</span>${icon("down")}</button><span class="activity-total">${count}</span></div>`;
    const noConversations = selected ? `${empty(`还没有与${escapeHtml(name)}的对话`, "选择开始对话，或查看其他人物的会话。")}<button class="sidebar-list-more" type="button" data-action="sidebar-all-conversations" data-focus="sidebar-show-all">显示全部人物</button>` : empty("还没有对话", "从下方新建第一段对话，会话会按最近活动排列。");
    return `<div class="sidebar-shortcuts">${renderCompanionEntry(store)}</div>${toolbar}<div class="conversation-list">${sections.length ? sections.map((entry) => section(entry.id, entry.title, listRows(entry.entries, entry.id, store, expandedLists, (entry) => entry.item.id, (entry) => activityRow(entry, store, true)), store)).join("") : noConversations}</div>`;
  }
  if (mode === "library") return `${section("library-pages", "我的空间", allGroups("space") || empty("还没有空间", "点击 + 添加，用来收纳对话与页面。"), store, "space")}`;
  if (mode === "projects") return `${section("projects-groups", "项目列表", allGroups("project") || empty("还没有项目", "点击 + 添加项目，分别管理 Coding 会话与资料。"), store, "project")}`;
  return "";
}

export function sidebarFooter(store: WorkspaceStore): string {
  const mode = store.state.navigationMode;
  const kind = sidebarCreationKind(store.state);
  const label = kind === "page" ? "新页面" : kind === "coding" ? "新 Coding 会话" : kind === "conversation" ? "新对话" : mode === "tasks" ? "新建任务" : "新建工具";
  return `<div class="sidebar-footer"><div class="sidebar-create-row"><button class="sidebar-create" type="button" data-action="sidebar-create" data-focus="sidebar-create" ${kind ? "" : `disabled title="${mode === "tasks" ? "任务" : "工具配置"}功能尚未开放"`}>${icon(kind === "page" ? "file" : kind === "coding" ? "code" : kind ? "edit" : "plus")}<span>${label}</span>${kind ? "<kbd>⌘N</kbd>" : ""}</button>${kind ? iconButton("down", "新建菜单", "new-tab", 'aria-haspopup="menu"', "sidebar-create-menu") : ""}</div></div>`;
}
