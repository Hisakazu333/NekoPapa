import { icon } from "./icons";
import type { IconName } from "./icons";
import { systemItems, WorkspaceStore } from "./state";
import type { GroupKind, WorkspaceItem } from "./state";
import { escapeHtml, iconButton, itemIcons, renderShell } from "./view";

interface MenuEntry {
  label: string;
  icon?: IconName;
  shortcut?: string;
  run: () => void;
}

export class ShellController {
  private store = new WorkspaceStore();
  private overlay: HTMLElement | null = null;
  private menuReturnFocus: HTMLElement | null = null;
  private lastClosed: string[] = [];
  private tabsObserver = new ResizeObserver(() => {
    this.updateTabOverflow();
    this.revealActiveTab();
  });

  constructor(private root: HTMLElement) {
    root.addEventListener("click", (event) => this.click(event));
    root.addEventListener("contextmenu", (event) => this.contextMenu(event));
    root.addEventListener("pointerdown", (event) => this.resize(event));
    root.addEventListener("dblclick", (event) => {
      if ((event.target as Element).closest(".sidebar-resizer")) this.setWidth(232);
    });
    document.addEventListener("pointerdown", (event) => {
      if (this.overlay && !(this.overlay instanceof HTMLDialogElement) && !this.overlay.contains(event.target as Node)) this.closeOverlay();
    });
    document.addEventListener("keydown", (event) => this.keydown(event));
    this.render();
  }

  private render(focusId?: string): void {
    const previous = (document.activeElement as HTMLElement | null)?.dataset.focus;
    const sidebarScroll = this.root.querySelector(".sidebar-scroll")?.scrollTop ?? 0;
    const tabsScroll = this.root.querySelector(".tab-scroll")?.scrollLeft ?? 0;
    this.root.style.setProperty("--sidebar-width", `${this.store.state.sidebarWidth}px`);
    this.root.classList.toggle("sidebar-hidden", !this.store.state.sidebarVisible);
    this.root.innerHTML = renderShell(this.store);
    const sidebar = this.root.querySelector(".sidebar-scroll");
    const tabs = this.root.querySelector(".tab-scroll");
    if (sidebar) sidebar.scrollTop = sidebarScroll;
    if (tabs) tabs.scrollLeft = tabsScroll;
    const focus = focusId ?? previous;
    if (focus) this.root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focus)}"]`)?.focus({ preventScroll: true });
    this.tabsObserver.disconnect();
    if (tabs) this.tabsObserver.observe(tabs);
    this.updateTabOverflow();
    this.revealActiveTab();
  }

  private revealActiveTab(): void {
    this.root.querySelector(".workspace-tab.is-selected")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  private updateTabOverflow(): void {
    const tabs = this.root.querySelector<HTMLElement>(".tab-scroll");
    const overflow = this.root.querySelector<HTMLButtonElement>('[data-action="tab-overflow"]');
    if (!tabs || !overflow) return;
    // Measure without the extra button so its own width cannot keep it visible.
    const available = tabs.clientWidth + (overflow.hidden ? 0 : overflow.offsetWidth + 4);
    const showOverflow = tabs.scrollWidth > available + 1;
    if (overflow.hidden === showOverflow) {
      overflow.hidden = !showOverflow;
    }
  }

  private open(id: string, focusTab = false): void {
    this.store.open(id);
    this.render(focusTab ? `tab-${id}` : undefined);
  }

  private closeTab(id: string): void {
    this.lastClosed.push(id);
    this.store.close(id);
    this.render(`tab-${this.store.state.activeId}`);
  }

  private toggleSidebar(): void {
    this.store.state.sidebarVisible = !this.store.state.sidebarVisible;
    this.store.persist();
    this.render();
  }

  private click(event: MouseEvent): void {
    const target = (event.target as Element).closest<HTMLButtonElement>("button[data-action]");
    if (!target || target.disabled) return;
    const id = target.dataset.id ?? "";
    switch (target.dataset.action) {
      case "open": this.open(id); break;
      case "close-tab": this.closeTab(id); break;
      case "toggle-group": this.store.toggleGroup(id); this.render(); break;
      case "toggle-sidebar": this.toggleSidebar(); break;
      case "back": this.store.travel(-1); this.render(); break;
      case "forward": this.store.travel(1); this.render(); break;
      case "search": this.search(); break;
      case "new-tab": this.newMenu(target); break;
      case "tab-overflow": this.menu(target, this.store.state.tabs.map((tabId) => {
        const item = this.store.item(tabId)!;
        return { label: item.title, icon: tabId === this.store.state.activeId ? "check" : itemIcons[item.kind], run: () => this.open(tabId, true) };
      }), "打开的标签页"); break;
      case "new-conversation": this.newItem("conversation"); break;
      case "add-group": this.newGroup(target.dataset.kind as GroupKind); break;
      case "item-menu": this.itemMenu(id, target); break;
      case "group-menu": this.groupMenu(id, target); break;
      case "workspace-menu": this.workspaceMenu(target); break;
      case "open-project": {
        const projectItem = this.store.state.items.find((item) => item.kind === "coding");
        if (projectItem) this.open(projectItem.id);
        else this.newItem("coding");
        break;
      }
      case "rail-menu": this.menu(target, [
        { label: "记忆", icon: "book", run: () => this.open("memory") },
        { label: "连接器", icon: "link", run: () => this.open("connections") },
        { label: "搜索", icon: "search", shortcut: "⌘K", run: () => this.search() },
      ]); break;
      case "notifications": this.menu(target, [], "通知", '<p class="notification-empty">暂无通知</p>'); break;
    }
  }

  private menu(anchor: HTMLElement | { x: number; y: number }, entries: MenuEntry[], heading?: string, extra = ""): void {
    this.closeOverlay();
    this.menuReturnFocus = anchor instanceof HTMLElement ? anchor : document.activeElement as HTMLElement | null;
    const menu = document.createElement("div");
    menu.className = "floating-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", heading ?? "操作菜单");
    menu.innerHTML = `${heading ? `<div class="menu-label">${escapeHtml(heading)}</div>` : ""}${entries.map((entry, index) => `<button type="button" class="menu-item" role="menuitem" data-menu-index="${index}">${entry.icon ? icon(entry.icon) : ""}<span>${escapeHtml(entry.label)}</span>${entry.shortcut ? `<span class="menu-shortcut">${entry.shortcut}</span>` : ""}</button>`).join("")}${extra}`;
    document.body.append(menu);
    const point = anchor instanceof HTMLElement ? { x: anchor.getBoundingClientRect().left, y: anchor.getBoundingClientRect().bottom + 5 } : anchor;
    menu.style.left = `${Math.max(8, Math.min(point.x, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(point.y, window.innerHeight - menu.offsetHeight - 8))}px`;
    this.overlay = menu;
    menu.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLElement>("[data-menu-index]");
      if (!button) return;
      const entry = entries[Number(button.dataset.menuIndex)];
      this.closeOverlay();
      entry?.run();
    });
    menu.addEventListener("keydown", (event) => {
      const buttons = [...menu.querySelectorAll<HTMLButtonElement>("button")];
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    });
    menu.querySelector<HTMLElement>("button")?.focus();
  }

  private newMenu(anchor: HTMLElement): void {
    this.menu(anchor, [
      { label: "新聊天", icon: "message", shortcut: "⌘N", run: () => this.newItem("conversation") },
      { label: "Coding 会话", icon: "code", run: () => this.newItem("coding") },
      { label: "新页面", icon: "file", run: () => this.newItem("page") },
    ], "新建标签页");
  }

  private workspaceMenu(anchor: HTMLElement): void {
    this.menu(anchor, [
      { label: "添加空间", icon: "folder", run: () => this.newGroup("space") },
      { label: "添加项目", icon: "code", run: () => this.newGroup("project") },
      { label: this.store.state.sidebarVisible ? "收起侧栏" : "展开侧栏", icon: "sidebar", shortcut: "⌘B", run: () => this.toggleSidebar() },
      { label: "设置", icon: "settings", run: () => this.open("settings") },
    ], "NekoPapa · 本地工作台");
  }

  private itemMenu(id: string, anchor: HTMLElement | { x: number; y: number }): void {
    const item = this.store.state.items.find((entry) => entry.id === id);
    if (!item) return;
    this.menu(anchor, [
      { label: "在标签页中打开", icon: itemIcons[item.kind], run: () => this.open(id, true) },
      { label: "重命名", icon: "edit", run: () => this.rename(id, item.title) },
      { label: this.store.state.favorites.includes(id) ? "取消收藏" : "收藏", icon: "star", run: () => { this.store.favorite(id); this.render(); } },
    ]);
  }

  private groupMenu(id: string, anchor: HTMLElement | { x: number; y: number }): void {
    const group = this.store.state.groups.find((entry) => entry.id === id);
    if (!group) return;
    this.menu(anchor, [
      { label: group.kind === "project" ? "新建 Coding 会话" : "新聊天", icon: group.kind === "project" ? "code" : "message", run: () => this.newItem(group.kind === "project" ? "coding" : "conversation", id) },
      { label: "新页面", icon: "file", run: () => this.newItem("page", id) },
      { label: "重命名", icon: "edit", run: () => this.rename(id, group.title) },
    ]);
  }

  private contextMenu(event: MouseEvent): void {
    const tab = (event.target as Element).closest<HTMLElement>("[data-context-tab]");
    if (tab) {
      event.preventDefault();
      const id = tab.dataset.contextTab!;
      const index = this.store.state.tabs.indexOf(id);
      this.menu({ x: event.clientX, y: event.clientY }, [
        { label: "关闭标签页", icon: "close", shortcut: "⌘W", run: () => this.closeTab(id) },
        { label: "关闭其他标签页", run: () => { this.store.state.tabs.filter((entry) => entry !== id).forEach((entry) => this.closeTab(entry)); this.open(id, true); } },
        { label: "关闭右侧标签页", run: () => { this.store.state.tabs.slice(index + 1).forEach((entry) => this.closeTab(entry)); } },
      ]);
      return;
    }
    const row = (event.target as Element).closest<HTMLElement>("[data-context-id]");
    if (!row) return;
    event.preventDefault();
    const id = row.dataset.contextId!;
    const point = { x: event.clientX, y: event.clientY };
    if (this.store.state.groups.some((entry) => entry.id === id)) this.groupMenu(id, point);
    else this.itemMenu(id, point);
  }

  private dialog(markup: string, className = ""): HTMLDialogElement {
    this.closeOverlay();
    const dialog = document.createElement("dialog");
    dialog.className = `shell-dialog ${className}`;
    dialog.innerHTML = markup;
    dialog.setAttribute("aria-labelledby", "dialog-title");
    dialog.addEventListener("close", () => { if (this.overlay === dialog) this.overlay = null; dialog.remove(); });
    dialog.addEventListener("click", (event) => {
      if ((event.target as Element).closest("[data-dismiss]")) this.closeOverlay();
      if (event.target === dialog) {
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.closeOverlay();
      }
    });
    document.body.append(dialog);
    this.overlay = dialog;
    dialog.showModal();
    return dialog;
  }

  private form(title: string, label: string, value: string, extra: string, onSubmit: (data: FormData) => void): void {
    const dialog = this.dialog(`<form><h2 class="dialog-heading" id="dialog-title">${escapeHtml(title)}${iconButton("close", "关闭", "dismiss", "data-dismiss")}</h2><label class="field-label" for="entry-name">${escapeHtml(label)}</label><input class="text-field" id="entry-name" name="title" required maxlength="72" autocomplete="off" value="${escapeHtml(value)}" autofocus />${extra}<div class="dialog-actions"><button type="button" class="text-button" data-dismiss>取消</button><button type="submit" class="primary-button">${title === "重命名" ? "保存" : "创建"}</button></div></form>`);
    const input = dialog.querySelector<HTMLInputElement>("input")!;
    input.addEventListener("input", () => input.setCustomValidity(""));
    dialog.querySelector("form")!.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.target as HTMLFormElement);
      const name = String(data.get("title") ?? "").trim();
      if (!name) { input.setCustomValidity("请输入名称"); input.reportValidity(); return; }
      data.set("title", name);
      this.closeOverlay();
      onSubmit(data);
    });
    input.focus();
    input.select();
  }

  private newItem(kind: "conversation" | "coding" | "page", preferredGroup?: string): void {
    const groups = this.store.state.groups.filter((group) => kind === "coding" ? group.kind === "project" : group.kind === "space" || group.id === preferredGroup);
    if (!groups.length) { this.newGroup(kind === "coding" ? "project" : "space", (id) => this.newItem(kind, id)); return; }
    const titles = { conversation: "新聊天", coding: "新 Coding 会话", page: "新页面" };
    const extra = `<label class="field-label" for="entry-group">${kind === "coding" ? "所属项目" : "保存到"}</label><select class="select-field" id="entry-group" name="groupId">${groups.map((group) => `<option value="${escapeHtml(group.id)}" ${preferredGroup === group.id ? "selected" : ""}>${escapeHtml(group.title)}</option>`).join("")}</select>`;
    this.form(titles[kind], "名称", titles[kind], extra, (data) => {
      const id = this.store.addItem(kind, String(data.get("title")), String(data.get("groupId")));
      this.render(`tab-${id}`);
    });
  }

  private newGroup(kind: GroupKind, afterCreate?: (id: string) => void): void {
    this.form(kind === "space" ? "添加空间" : "添加项目", "名称", "", "", (data) => {
      const id = this.store.addGroup(kind, String(data.get("title")));
      this.store.state.sidebarVisible = true;
      this.store.persist();
      this.render(`group-${id}`);
      afterCreate?.(id);
    });
  }

  private rename(id: string, title: string): void {
    this.form("重命名", "名称", title, "", (data) => {
      this.store.rename(id, String(data.get("title")));
      this.render();
    });
  }

  private search(): void {
    const dialog = this.dialog(`<h2 class="sr-only" id="dialog-title">搜索工作台</h2><div class="search-input-row">${icon("search")}<input class="search-input" aria-label="搜索内容" placeholder="搜索会话、页面和项目…" aria-controls="search-results" autocomplete="off" autofocus /><kbd>esc</kbd></div><div class="search-results" id="search-results" role="listbox" aria-label="搜索结果"></div><div class="search-help">↑ ↓ 选择　↵ 打开</div>`, "search-dialog");
    const input = dialog.querySelector<HTMLInputElement>("input")!;
    const results = dialog.querySelector<HTMLElement>(".search-results")!;
    let selection = 0;
    let matches: WorkspaceItem[] = [];
    const drawResults = () => {
      const query = input.value.trim().toLocaleLowerCase();
      matches = [...this.store.state.items, ...systemItems].filter((item) => {
        const group = this.store.state.groups.find((entry) => entry.id === item.groupId);
        return `${item.title} ${group?.title ?? ""}`.toLocaleLowerCase().includes(query);
      }).slice(0, 20);
      selection = Math.max(0, Math.min(selection, matches.length - 1));
      results.innerHTML = matches.length ? matches.map((item, index) => `<button class="search-result ${index === selection ? "is-selected" : ""}" type="button" role="option" id="search-option-${index}" aria-selected="${index === selection}" data-result="${index}">${icon(itemIcons[item.kind])}<span>${escapeHtml(item.title)}</span><small>${escapeHtml(this.store.state.groups.find((entry) => entry.id === item.groupId)?.title ?? "工作台")}</small></button>`).join("") : '<p class="search-empty">没有匹配的内容</p>';
      if (matches.length) input.setAttribute("aria-activedescendant", `search-option-${selection}`);
      else input.removeAttribute("aria-activedescendant");
      results.querySelector(".is-selected")?.scrollIntoView({ block: "nearest" });
    };
    const choose = (index: number) => { const item = matches[index]; if (item) { this.closeOverlay(); this.open(item.id, true); } };
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

  private closeOverlay(): void {
    const returnFocus = this.menuReturnFocus;
    this.menuReturnFocus = null;
    if (this.overlay instanceof HTMLDialogElement) this.overlay.close();
    this.overlay?.remove();
    this.overlay = null;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }

  private setWidth(width: number): void {
    this.store.state.sidebarWidth = Math.max(196, Math.min(320, width));
    this.store.persist();
    this.render("sidebar-resizer");
  }

  private resize(event: PointerEvent): void {
    if (!(event.target as Element).closest(".sidebar-resizer") || event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = this.store.state.sidebarWidth;
    let width = startWidth;
    this.root.classList.add("is-resizing");
    const move = (next: PointerEvent) => {
      width = Math.max(196, Math.min(320, startWidth + next.clientX - startX));
      this.root.style.setProperty("--sidebar-width", `${width}px`);
    };
    const finish = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      this.root.classList.remove("is-resizing");
      this.setWidth(width);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
  }

  private keydown(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === "Escape" && this.overlay) { event.preventDefault(); this.closeOverlay(); return; }
    if (this.overlay instanceof HTMLDialogElement) return;
    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (modifier && ["t", "n", "w", "k", "b"].includes(key)) {
      event.preventDefault();
      if (key === "t") {
        if (event.shiftKey) {
          const closed = this.lastClosed.pop();
          if (closed) this.open(closed, true);
        }
        else this.newItem("conversation");
      }
      if (key === "n") this.newItem("conversation");
      if (key === "w") this.closeTab(this.store.state.activeId);
      if (key === "k") this.search();
      if (key === "b") this.toggleSidebar();
      return;
    }
    if (event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); this.store.travel(event.key === "ArrowLeft" ? -1 : 1); this.render(); return; }
    const target = event.target as HTMLElement;
    if (target.classList.contains("sidebar-resizer") && ["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) { event.preventDefault(); this.setWidth(event.key === "Home" ? 232 : this.store.state.sidebarWidth + (event.key === "ArrowRight" ? 8 : -8)); return; }
    if ((target.getAttribute("role") === "tab" && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) || (event.ctrlKey && event.key === "Tab")) {
      event.preventDefault();
      const tabs = this.store.state.tabs;
      const index = tabs.indexOf(this.store.state.activeId);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowLeft" || event.shiftKey ? -1 : 1) + tabs.length) % tabs.length;
      this.open(tabs[next], true);
    }
  }
}
