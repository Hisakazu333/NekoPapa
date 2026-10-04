import { icon } from "./icons";
import type { IconName } from "./icons";
import { rankSearchEntries } from "./search";
import { sidebarCreationKind, isSession } from "./state";
import type { WorkspaceStore, ContentKind, GroupKind, NavigationMode, WorkspaceItem } from "./state";
import { escapeHtml, iconButton, itemIcon } from "./view-shared";
import { renderArchive } from "./view";
import type { ShellOverlays, MenuEntry, MenuPoint, MenuOptions } from "./overlays";
import { companionCatalog, companionName } from "./companion-model";

interface SearchEntry { id: string; title: string; icon: IconName; subtitle: string; group: boolean; companionId?: string }
interface ActionsHost {
  render(focusId?: string, locateActive?: boolean): void;
  open(id: string, focusTab?: boolean): void;
  closeTab(id: string): void;
  closeTabs(ids: string[]): void;
  navigationSettings(anchor: HTMLElement): void;
  continueCompanion(id: string): void;
}

export class ShellActions {
  private notice: HTMLElement | null = null;
  private archiveQuery = "";
  constructor(private root: HTMLElement, private store: WorkspaceStore, private overlays: ShellOverlays, private host: ActionsHost) {}

  accountMenu(anchor: HTMLElement): void {
    this.overlays.menu(anchor, [
      { label: "登录账号", icon: "login", status: "暂未开放", disabled: true, run: () => {} },
      { label: "使用情况", icon: "usage", status: "登录后可用", disabled: true, separatorBefore: true, run: () => {} },
      { label: "设置", icon: "settings", run: () => this.host.navigationSettings(anchor) },
      { label: "帮助", icon: "help", separatorBefore: true, submenu: [
        { label: "键盘快捷键", icon: "keyboard", run: () => this.accountHelp("shortcuts") },
        { label: "导航使用指南", icon: "book", run: () => this.accountHelp("guide") },
        { label: "关于 NekoPapa", icon: "cat", run: () => this.accountHelp("about") },
      ], run: () => {} },
    ], "账号菜单", "", {
      className: "account-menu",
      header: `<div class="account-menu-header"><span class="account-avatar" aria-hidden="true">${icon("user")}</span><div class="account-identity"><strong>未登录</strong><span>NekoPapa 账号</span></div></div><div class="menu-rule" role="separator"></div>`,
    });
  }

  accountHelp(kind: "shortcuts" | "guide" | "about"): void {
    const command = /Mac/.test(navigator.platform) ? "⌘" : "Ctrl+";
    const titles = { shortcuts: "键盘快捷键", guide: "导航使用指南", about: "关于 NekoPapa" };
    const shortcuts = [["展开或还原内容区", `⇧${command}F`], ["搜索内容", `${command}K`], ["新建当前分类内容", `${command}N`], ["新建标签菜单", `${command}T`], ["关闭当前标签", `${command}W`], ["恢复关闭的标签", `⇧${command}T`], ["展开或收起侧栏", `${command}B`], ["打开或关闭活动视图", `${/Mac/.test(navigator.platform) ? "⌥" : "Alt+"}${command}U`], ["打开条目操作", "Shift+F10"]];
    const content = kind === "shortcuts" ? `<dl class="shortcut-list">${shortcuts.map(([label, key]) => `<div><dt>${label}</dt><dd><kbd>${key}</kbd></dd></div>`).join("")}</dl>` : kind === "guide" ? `<div class="account-help-copy"><p>左侧图标切换查找范围，顶部标签保留已经打开的内容。</p><p>点击分组箭头展开列表；点击分组名称选择新建位置。拖动内容可以排序或移入允许的分组。</p><p>关闭标签保留内容；归档后可以从侧栏的归档入口恢复。</p></div>` : `<div class="account-help-copy"><p class="about-product">NekoPapa</p><p>为普通陪伴与 Coding 会话设计的桌面工作台。</p><p>当前提供侧栏与顶部标签管理；聊天正文、Pi 和账号登录将在后续接入。</p></div>`;
    this.overlays.dialog(`<div class="account-help-content"><h2 class="dialog-heading" id="dialog-title">${titles[kind]}${iconButton("close", "关闭", "dismiss", "data-dismiss")}</h2>${content}<div class="dialog-actions"><button type="button" class="text-button" data-dismiss autofocus>关闭</button></div></div>`, "account-help-dialog");
  }

  newMenu(anchor: HTMLElement): void {
    const kind = sidebarCreationKind(this.store.state);
    const tabMenu = anchor.closest(".window-chrome") !== null;
    const entries: MenuEntry[] = [
      { label: "新对话", icon: "message", shortcut: kind === "conversation" ? "⌘N" : undefined, run: () => this.newItem("conversation") },
      { label: "Coding 会话", icon: "code", shortcut: kind === "coding" ? "⌘N" : undefined, run: () => this.newItem("coding") },
      { label: "新页面", icon: "file", shortcut: kind === "page" ? "⌘N" : undefined, run: () => this.newItem("page") },
    ];
    if (tabMenu) entries.push(
      { label: "打开已有内容…", icon: "search", shortcut: "⌘K", separatorBefore: true, run: () => this.search() },
      { label: "恢复关闭的标签页", icon: "layers", shortcut: "⇧⌘T", disabled: !this.store.canRestoreClosed, run: () => this.restoreClosedTab() },
    );
    this.overlays.menu(anchor, entries, tabMenu ? "标签页" : "新建内容");
  }

  itemMenu(id: string, anchor: HTMLElement | MenuPoint, options: MenuOptions = {}): void {
    const item = this.store.state.items.find((entry) => entry.id === id);
    if (!item) return;
    const favorite = anchor instanceof HTMLElement && anchor.closest('[data-drag-kind="favorite"]');
    const activityView = this.store.state.activityVisible || this.store.state.navigationMode === "chat" || (this.store.state.navigationMode === "home" && !favorite);
    const peers = favorite ? [...favorite.closest(".section-contents")!.querySelectorAll<HTMLElement>('[data-drag-kind="favorite"]')].map((entry) => entry.dataset.dragId!) :
      this.store.state.items.filter((entry) => entry.groupId === item.groupId && (this.store.state.navigationMode !== "chat" || entry.kind === "conversation")).map((entry) => entry.id);
    const index = peers.indexOf(id);
    const reorder = (delta: -1 | 1) => {
      const before = delta === -1 ? peers[index - 1] : peers[index + 2];
      const changed = favorite ? this.store.reorderFavorite(id, before) : this.store.reorderItem(id, before, item.groupId!);
      if (changed) this.host.render();
    };
    this.overlays.menu(anchor, [
      { label: "在标签页中打开", icon: itemIcon(item), run: () => this.host.open(id, true) },
      { label: "重命名", icon: "edit", run: () => this.rename(id, item.title) },
      { label: "移动到…", icon: "folder", run: () => this.moveItem(id) },
      { label: this.store.state.favorites.includes(id) ? "取消收藏" : "收藏", icon: "star", run: () => { this.store.favorite(id); this.host.render(); } },
      ...this.sessionMenuEntries(item),
      ...(!activityView ? [
        { label: favorite ? "收藏上移" : "分组内上移", icon: "up" as const, disabled: index <= 0, run: () => reorder(-1) },
        { label: favorite ? "收藏下移" : "分组内下移", icon: "down" as const, disabled: index < 0 || index === peers.length - 1, run: () => reorder(1) },
      ] : []),
      { label: "归档", icon: "archive", separatorBefore: true, run: () => this.archiveItem(id) },
    ], undefined, "", options);
  }

  sessionMenuEntries(item: WorkspaceItem): MenuEntry[] {
    if (!isSession(item)) return [];
    return [
      { label: item.activity?.pinned ? "取消置顶" : "置顶会话", icon: "pin", run: () => { this.store.pinSession(item.id); this.host.render(); } },
      { label: item.activity?.unread ? "标为已读" : "标为未读", icon: item.activity?.unread ? "check" : "bell", run: () => { this.store.markSessionRead(item.id, item.activity?.unread === true); this.host.render(); } },
    ];
  }

  groupMenu(id: string, anchor: HTMLElement | MenuPoint, options: MenuOptions = {}): void {
    const group = this.store.state.groups.find((entry) => entry.id === id);
    if (!group) return;
    const conversation: MenuEntry = { label: group.kind === "project" ? "新建 Coding 会话" : "新对话", icon: group.kind === "project" ? "code" : "message", run: () => this.newItem(group.kind === "project" ? "coding" : "conversation", id) };
    const page: MenuEntry = { label: "新页面", icon: "file", run: () => this.newItem("page", id) };
    const siblings = this.store.state.groups.filter((entry) => entry.kind === group.kind);
    const index = siblings.findIndex((entry) => entry.id === id);
    this.overlays.menu(anchor, [
      { label: "选择此分组", icon: "folderOpen", run: () => { this.store.locateGroup(id, true); this.host.render(`group-${id}`, true); } },
      ...(this.store.state.navigationMode === "library" ? [page, conversation] : [conversation, page]),
      { label: "重命名", icon: "edit", run: () => this.rename(id, group.title) },
      { label: "上移", icon: "up", disabled: index === 0, run: () => { this.store.moveGroup(id, -1); this.host.render(`group-${id}`); } },
      { label: "下移", icon: "down", disabled: index === siblings.length - 1, run: () => { this.store.moveGroup(id, 1); this.host.render(`group-${id}`); } },
      { label: `归档${group.kind === "project" ? "项目" : "空间"}`, icon: "archive", separatorBefore: true, run: () => this.archiveGroup(id) },
    ], undefined, "", options);
  }

  openContextMenu(target: Element, point?: MenuPoint): boolean {
    const rail = target.closest<HTMLElement>('[data-drag-kind="rail"]');
    if (rail) {
      const id = rail.dataset.dragId as NavigationMode;
      const peers: NavigationMode[] = this.store.state.railOrder.filter((entry) => entry !== "tasks" && entry !== "tools");
      const index = peers.indexOf(id);
      this.overlays.menu(rail, [
        { label: "上移", icon: "up", disabled: index <= 0, run: () => { this.store.reorderRail(id, peers[index - 1]); this.host.render(`rail-${id}`); } },
        { label: "下移", icon: "down", disabled: index === peers.length - 1, run: () => { this.store.reorderRail(id, peers[index + 2]); this.host.render(`rail-${id}`); } },
      ], "导航排序", "", { point, toggle: false });
      return true;
    }
    const tab = target.closest<HTMLElement>("[data-context-tab]");
    if (tab) {
      const id = tab.dataset.contextTab!;
      const index = this.store.state.tabs.indexOf(id);
      const item = this.store.state.items.find((entry) => entry.id === id);
      const group = id.startsWith("group:") ? this.store.state.groups.find((entry) => `group:${entry.id}` === id) : undefined;
      const anchor = target.closest<HTMLElement>("button") ?? tab.querySelector<HTMLElement>(".tab-target")!;
      this.overlays.menu(anchor, [
        { label: "关闭标签页", icon: "close", shortcut: "⌘W", disabled: id === "home" && this.store.state.tabs.length === 1, run: () => this.host.closeTab(id) },
        { label: "关闭其他标签页", disabled: this.store.state.tabs.length === 1, run: () => this.host.closeTabs(this.store.state.tabs.filter((entry) => entry !== id)) },
        { label: "关闭右侧标签页", disabled: index === this.store.state.tabs.length - 1, run: () => this.host.closeTabs(this.store.state.tabs.slice(index + 1)) },
        { label: "恢复关闭的标签页", icon: "layers", shortcut: "⇧⌘T", disabled: !this.store.canRestoreClosed, run: () => this.restoreClosedTab() },
        { label: "标签左移", disabled: index === 0, separatorBefore: true, run: () => { this.store.moveTab(id, -1); this.host.render(`tab-${this.store.state.activeId}`); } },
        { label: "标签右移", disabled: index === this.store.state.tabs.length - 1, run: () => { this.store.moveTab(id, 1); this.host.render(`tab-${this.store.state.activeId}`); } },
        ...(item ? [
          { label: "重命名", icon: "edit" as const, separatorBefore: true, run: () => this.rename(id, item.title) },
          { label: "移动到…", icon: "folder" as const, run: () => this.moveItem(id) },
          { label: this.store.state.favorites.includes(id) ? "取消收藏" : "收藏", icon: "star" as const, run: () => { this.store.favorite(id); this.host.render(); } },
          ...this.sessionMenuEntries(item),
          { label: "归档", icon: "archive" as const, run: () => this.archiveItem(id) },
        ] : group ? [
          { label: "重命名", icon: "edit" as const, separatorBefore: true, run: () => this.rename(group.id, group.title) },
          { label: "归档", icon: "archive" as const, run: () => this.archiveGroup(group.id) },
        ] : []),
      ], undefined, "", { point, toggle: false });
      return true;
    }
    const row = target.closest<HTMLElement>("[data-context-id]");
    if (!row) return false;
    const id = row.dataset.contextId!;
    const anchor = target.closest<HTMLElement>("button") ?? row.querySelector<HTMLElement>(".row-main, .activity-open")!;
    const options = { point, toggle: false };
    if (this.store.state.groups.some((entry) => entry.id === id)) this.groupMenu(id, anchor, options);
    else if (this.store.state.items.some((entry) => entry.id === id)) this.itemMenu(id, anchor, options);
    else return false;
    return true;
  }

  newItem(kind: ContentKind, preferredGroup?: string): void {
    const companionId = this.store.state.selectedCompanionId;
    const groups = this.store.creationGroups(kind);
    const selected = this.store.creationGroup(kind, preferredGroup);
    const titles = { conversation: "新对话", coding: "新 Coding 会话", page: "新页面" };
    const groupKind = kind === "coding" || groups.find((group) => group.id === selected)?.kind === "project" || this.store.state.navigationMode === "projects" ? "project" : "space";
    const newGroupField = `<div data-new-group-field ${groups.length ? "hidden" : ""}><label class="field-label" for="entry-new-group">${groupKind === "project" ? "新项目名称" : "新空间名称"}</label><input class="text-field" id="entry-new-group" name="groupTitle" ${groups.length ? "disabled" : "required"} maxlength="72" autocomplete="off" value="${groupKind === "project" ? "新项目" : "我的空间"}" /></div>`;
    const character = kind === "conversation" ? `<p class="creation-companion">陪伴角色<span>${companionName(companionId)}</span></p>` : "";
    const extra = character + (groups.length ? `<label class="field-label" for="entry-group">${kind === "coding" ? "所属项目" : "保存到"}</label><select class="select-field" id="entry-group" name="groupId">${groups.map((group) => `<option value="${escapeHtml(group.id)}" ${selected === group.id ? "selected" : ""}>${escapeHtml(group.title)} · ${group.kind === "project" ? "项目" : "空间"}</option>`).join("")}<option value="">＋ 新建${groupKind === "project" ? "项目" : "空间"}…</option></select>` : "") + newGroupField;
    this.overlays.form(titles[kind], "名称", titles[kind], extra, (data) => {
      const groupId = String(data.get("groupId") ?? "");
      const id = groupId ? this.store.addItem(kind, String(data.get("title")), groupId, companionId) : this.store.addItemWithGroup(kind, String(data.get("title")), String(data.get("groupTitle")), groupKind, companionId);
      if (id) {
        const item = this.store.item(id)!;
        const parent = this.store.state.groups.find((entry) => entry.id === item.groupId)!;
        const mode = this.store.state.navigationMode;
        const inActivity = this.store.state.activityVisible;
        const visible = inActivity ? isSession(item) : mode === "home" || (mode === "chat" && kind === "conversation") || (mode === "library" && parent.kind === "space") || (mode === "projects" && parent.kind === "project");
        // An explicit creation in another mode reveals its new record once committed.
        if (!visible) this.store.navigate(parent.kind === "project" ? "projects" : kind === "conversation" ? "chat" : "library");
        if (!this.store.state.activityVisible && (this.store.state.navigationMode === "library" || this.store.state.navigationMode === "projects")) this.store.locateGroup(parent.id, true);
        this.host.render(`tab-${id}`, true);
      }
    });
    this.overlays.overlay?.querySelector<HTMLSelectElement>("select")?.addEventListener("change", (event) => {
      const createGroup = !(event.target as HTMLSelectElement).value;
      const field = this.overlays.overlay!.querySelector<HTMLInputElement>('[name="groupTitle"]')!;
      field.disabled = !createGroup;
      field.required = createGroup;
      this.overlays.overlay!.querySelector<HTMLElement>("[data-new-group-field]")!.hidden = !createGroup;
    });
  }

  newGroup(kind: GroupKind): void {
    this.overlays.form(kind === "space" ? "添加空间" : "添加项目", "名称", "", "", (data) => {
      const id = this.store.addGroup(kind, String(data.get("title")));
      if (id) { this.store.locateGroup(id, true); this.host.render(`group-${id}`); }
    });
  }

  rename(id: string, title: string): void {
    this.overlays.form("重命名", "名称", title, "", (data) => {
      this.store.rename(id, String(data.get("title")));
      this.host.render();
    });
  }

  moveItem(id: string): void {
    const item = this.store.state.items.find((entry) => entry.id === id);
    if (!item) return;
    const groups = this.store.state.groups.filter((group) => item.kind !== "coding" || group.kind === "project");
    const dialog = this.overlays.dialog(`<form><h2 class="dialog-heading" id="dialog-title">移动到${iconButton("close", "关闭", "dismiss", "data-dismiss")}</h2><p class="move-item-title">${escapeHtml(item.title)}</p><label class="field-label" for="move-group">选择空间或项目</label><select class="select-field" id="move-group" name="groupId" autofocus>${groups.map((group) => `<option value="${escapeHtml(group.id)}" ${item.groupId === group.id ? "selected" : ""}>${escapeHtml(group.title)}</option>`).join("")}</select><div class="dialog-actions"><button class="text-button" type="button" data-dismiss>取消</button><button class="primary-button" type="submit">移动</button></div></form>`);
    dialog.querySelector("form")!.addEventListener("submit", (event) => {
      event.preventDefault();
      const groupId = String(new FormData(event.target as HTMLFormElement).get("groupId"));
      if (!this.store.move(id, groupId)) return;
      this.overlays.close();
      this.host.render(`tab-${this.store.state.activeId}`, true);
    });
    dialog.querySelector<HTMLSelectElement>("select")!.focus();
  }

  search(): void {
    const dialog = this.overlays.dialog(`<h2 class="sr-only" id="dialog-title">搜索工作台</h2><div class="search-input-row">${icon("search")}<input class="search-input" role="combobox" aria-label="搜索内容" placeholder="搜索会话、页面和项目…" aria-controls="search-results" aria-expanded="true" aria-autocomplete="list" autocomplete="off" autofocus /><kbd>esc</kbd></div><div class="search-results" id="search-results" role="listbox" aria-label="搜索结果"></div><div class="search-help">↑ ↓ 选择　↵ 打开</div>`, "search-dialog");
    const input = dialog.querySelector<HTMLInputElement>("input")!;
    const results = dialog.querySelector<HTMLElement>(".search-results")!;
    let selection = 0;
    let matches: SearchEntry[] = [];
    const drawResults = () => {
      const toEntry = (item: WorkspaceItem): SearchEntry => ({ id: item.id, title: item.title, icon: itemIcon(item), subtitle: this.store.state.groups.find((entry) => entry.id === item.groupId)?.title ?? "工作台", group: false });
      matches = rankSearchEntries([
        ...this.store.state.items.map(toEntry),
        ...this.store.state.groups.map((group): SearchEntry => ({ id: group.id, title: group.title, icon: group.kind === "project" ? "code" : "folder", subtitle: group.kind === "project" ? "项目 · 定位分组" : "空间 · 定位分组", group: true })),
        { id: "home", title: "首页", icon: "home", subtitle: "工作台", group: false },
        ...companionCatalog.map((companion): SearchEntry => ({ id: `character:${companion.id}`, title: companion.name, icon: "cat", subtitle: "陪伴角色 · 打开对话", group: false, companionId: companion.id })),
        { id: "archive", title: "归档", icon: "archive", subtitle: "工作台管理", group: false },
      ], input.value);
      selection = Math.max(0, Math.min(selection, matches.length - 1));
      results.innerHTML = matches.length ? matches.map((item, index) => `<button class="search-result ${index === selection ? "is-selected" : ""}" type="button" role="option" id="search-option-${index}" aria-selected="${index === selection}" data-result="${index}" title="${escapeHtml(`${item.title} · ${item.subtitle}`)}">${icon(item.icon)}<span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.subtitle)}</small></button>`).join("") : '<p class="search-empty">没有匹配的内容</p>';
      if (matches.length) input.setAttribute("aria-activedescendant", `search-option-${selection}`);
      else input.removeAttribute("aria-activedescendant");
      results.querySelector(".is-selected")?.scrollIntoView({ block: "nearest" });
    };
    const choose = (index: number) => {
      const item = matches[index];
      if (!item) return;
      this.overlays.close();
      if (item.group) { this.store.locateGroup(item.id); this.host.render(`group-${item.id}`); }
      else if (item.companionId) this.host.continueCompanion(item.companionId);
      else this.host.open(item.id, true);
    };
    input.addEventListener("input", () => { selection = 0; drawResults(); });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); selection = (selection + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % Math.max(1, matches.length); drawResults(); }
      if (event.key === "Enter") { event.preventDefault(); choose(selection); }
    });
    results.addEventListener("click", (event) => {
      const target = (event.target as Element).closest<HTMLElement>("[data-result]");
      if (target) choose(Number(target.dataset.result));
    });
    drawResults();
    input.focus();
  }

  restoreClosedTab(): void {
    const id = this.store.restoreClosed();
    if (id) this.host.render(`tab-${id}`, true);
  }

  filterArchives(): void {
    const scope = this.overlays.overlay ?? this.root;
    const input = scope.querySelector<HTMLInputElement>("[data-archive-search]");
    if (!input) return;
    if (input.value !== this.archiveQuery) input.value = this.archiveQuery;
    const query = this.archiveQuery.trim().toLocaleLowerCase();
    const rows = [...scope.querySelectorAll<HTMLElement>("[data-archive-entry]")];
    let matches = 0;
    for (const row of rows) {
      row.hidden = !(row.dataset.searchText ?? row.textContent ?? "").toLocaleLowerCase().includes(query);
      if (!row.hidden) matches++;
    }
    const empty = scope.querySelector<HTMLElement>("[data-archive-empty]");
    if (empty) empty.hidden = !rows.length || matches > 0;
  }

  archiveDialog(): void {
    const dialog = this.overlays.dialog(`<h2 class="dialog-heading" id="dialog-title">归档${iconButton("close", "关闭归档", "dismiss", "data-dismiss")}</h2>${renderArchive(this.store)}`, "archive-dialog");
    dialog.addEventListener("input", (event) => {
      const input = event.target as HTMLInputElement;
      if (!input.matches("[data-archive-search]")) return;
      this.archiveQuery = input.value;
      this.filterArchives();
    });
    dialog.addEventListener("click", (event) => {
      const target = (event.target as Element).closest<HTMLButtonElement>("[data-action]");
      if (target?.dataset.action === "restore-archive") this.restoreArchive(target.dataset.id ?? "");
    });
    this.filterArchives();
    (dialog.querySelector<HTMLInputElement>("[data-archive-search]") ?? dialog.querySelector<HTMLButtonElement>("[data-dismiss]"))?.focus();
  }

  archiveItem(id: string): void {
    const item = this.store.state.items.find((entry) => entry.id === id);
    if (!item) return;
    const record = this.store.archiveItem(id);
    if (!record) return;
    this.host.render(`tab-${this.store.state.activeId}`, true);
    this.notify(`已归档「${item.title}」`, record);
  }

  archiveGroup(id: string): void {
    const group = this.store.state.groups.find((entry) => entry.id === id);
    if (!group) return;
    const count = this.store.state.items.filter((item) => item.groupId === id).length;
    const dialog = this.overlays.dialog(`<form><h2 class="dialog-heading" id="dialog-title">归档${group.kind === "project" ? "项目" : "空间"}${iconButton("close", "关闭", "dismiss", "data-dismiss")}</h2><p class="move-item-title">「${escapeHtml(group.title)}」${count ? `和其中的 ${count} 条内容将一起归档` : "将从常用列表收起"}。可以在归档中恢复到原位置。</p><div class="dialog-actions"><button type="button" class="text-button" data-dismiss>取消</button><button type="submit" class="primary-button">归档</button></div></form>`);
    dialog.querySelector("form")!.addEventListener("submit", (event) => {
      event.preventDefault();
      const record = this.store.archiveGroup(id);
      if (!record) return;
      this.overlays.close();
      this.host.render(`tab-${this.store.state.activeId}`, true);
      this.notify(`已归档「${group.title}」`, record);
    });
    dialog.querySelector<HTMLButtonElement>("[data-dismiss].text-button")!.focus();
  }

  restoreArchive(id: string): void {
    const result = this.store.restoreArchive(id);
    if (!result) return;
    this.overlays.close(false);
    if (result.itemId) this.host.open(result.itemId, true);
    else if (result.groupId) { this.store.locateGroup(result.groupId); this.host.render(`group-${result.groupId}`, true); }
    else this.host.render();
    this.notify("已恢复到原位置");
  }

  notify(message: string, archiveId?: string): void {
    this.notice?.remove();
    const notice = document.createElement("div");
    notice.className = "shell-notice";
    notice.setAttribute("role", "status");
    notice.innerHTML = `<span>${escapeHtml(message)}</span>${archiveId ? '<button class="text-button" type="button" data-undo>撤销</button><button class="text-button" type="button" data-show-archive>查看归档</button>' : ""}<button class="icon-button" type="button" data-dismiss-notice aria-label="关闭提示">${icon("close")}</button>`;
    notice.addEventListener("click", (event) => {
      const target = (event.target as Element).closest("button");
      if (!target) return;
      if (target.hasAttribute("data-undo") && archiveId) this.restoreArchive(archiveId);
      else if (target.hasAttribute("data-show-archive")) { this.host.open("archive", true); notice.remove(); }
      else if (target.hasAttribute("data-dismiss-notice")) notice.remove();
    });
    document.body.append(notice);
    this.notice = notice;
  }

  exportRecovery(): void {
    if (!this.store.recoveryData) return;
    const url = URL.createObjectURL(new Blob([this.store.recoveryData], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `nekopapa-workspace-recovery-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    // Release only after the browser has accepted the download navigation.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

}
