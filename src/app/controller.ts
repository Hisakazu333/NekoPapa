import { defaultPresentation } from "./chrome";
import { FeatureActions } from "./feature-actions";
import { CompanionActions } from "./companion-actions";
import { companionById, conversationForCompanion } from "./companion-model";
import { contentMenu, openedTabsMenu } from "./chrome-actions";
import { ShellOverlays } from "./overlays";
import { ShellActions } from "./content-actions";
import { IconMotion } from "./motion";
import { ShellDragController } from "./drag";
import type { DragRef, DragTarget } from "./drag";
import { sidebarCreationKind, defaultRailOrder, navigationModes, WorkspaceStore } from "./state";
import type { GroupKind, NavigationMode } from "./state";
import { unreadSessionCount } from "./activity";
import { renderShell } from "./view";

export class ShellController {
  private store = new WorkspaceStore();
  private presentation = defaultPresentation();
  private iconMotion = new IconMotion();
  private overlays: ShellOverlays;
  private actions: ShellActions;
  private features: FeatureActions;
  private companions: CompanionActions;
  private sidebarScroll = new Map<string, number>();
  private tabsObserver = new ResizeObserver(() => {
    this.updateTabOverflow();
    this.revealActiveTab();
  });

  constructor(private root: HTMLElement) {
    this.overlays = new ShellOverlays(root);
    this.companions = new CompanionActions(this.store, this.overlays, (focus) => this.render(focus));
    this.actions = new ShellActions(root, this.store, this.overlays, {
      render: (focus, locate) => this.render(focus, locate), open: (id, focus) => this.open(id, focus),
      closeTab: (id) => this.closeTab(id), closeTabs: (ids) => this.closeTabs(ids),
      navigationSettings: (anchor) => this.navigationSettings(anchor),
      continueCompanion: (id) => this.continueCompanion(id),
    });
    this.features = new FeatureActions(root, this.store, this.overlays, {
      render: (focus) => this.render(focus), continueCompanion: () => this.continueCompanion(),
      chooseCompanion: () => {
        const selector = this.store.state.sidebarVisible ? this.root.querySelector<HTMLElement>('[data-focus="companion-selector"]') : null;
        const anchor = selector ?? this.root.querySelector<HTMLElement>('[data-focus="feature-characters"]') ?? this.root.querySelector<HTMLElement>('[data-focus="feature-menu"]');
        if (anchor) this.companions.menu(anchor);
      },
      showActivity: () => {
        if (!this.store.state.activityVisible) this.store.toggleActivity();
        this.render("activity-toggle");
      },
    });
    new ShellDragController(root, {
      beforeDrag: () => { this.overlays.close(false); this.iconMotion.cancel(); },
      canDrop: (source, target) => this.dragDestination(source, target) !== undefined,
      drop: (source, target) => this.drop(source, target),
      didDrop: (focus) => this.render(focus),
    });
    root.addEventListener("click", (event) => this.click(event));
    root.addEventListener("contextmenu", (event) => this.contextMenu(event));
    root.addEventListener("auxclick", (event) => this.middleTabClick(event));
    root.addEventListener("scroll", (event) => {
      if (event.target instanceof HTMLElement && event.target.matches(".sidebar-scroll, .tab-scroll") && this.overlays.overlay && !(this.overlays.overlay instanceof HTMLDialogElement)) this.overlays.close();
    }, true);
    root.addEventListener("pointerdown", (event) => {
      if (event.button === 1 && (event.target as Element).closest("[data-context-tab]")) event.preventDefault();
      this.resize(event);
    });
    root.addEventListener("dblclick", (event) => {
      if ((event.target as Element).closest(".sidebar-resizer")) this.setWidth(232);
    });
    document.addEventListener("pointerdown", (event) => {
      if (this.overlays.overlay && !(this.overlays.overlay instanceof HTMLDialogElement) && !this.overlays.overlay.contains(event.target as Node) && !this.overlays.menuAnchor?.contains(event.target as Node)) this.overlays.close(false);
    });
    document.addEventListener("keydown", (event) => this.keydown(event));
    window.addEventListener("resize", () => {
      if (this.overlays.overlay && !(this.overlays.overlay instanceof HTMLDialogElement)) this.overlays.close();
    });
    this.render();
  }

  private render(focusId?: string, locateActive = false): void {
    const previous = (document.activeElement as HTMLElement | null)?.dataset.focus;
    const previousSidebar = this.root.querySelector<HTMLElement>(".sidebar-scroll");
    if (previousSidebar) this.sidebarScroll.set(previousSidebar.dataset.scrollKey!, previousSidebar.scrollTop);
    const tabsScroll = this.root.querySelector(".tab-scroll")?.scrollLeft ?? 0;
    this.root.style.setProperty("--sidebar-width", `${this.store.state.sidebarWidth}px`);
    this.root.classList.toggle("sidebar-hidden", !this.store.state.sidebarVisible);
    this.root.classList.toggle("is-full-view", this.presentation.fullView);
    this.root.classList.toggle("details-open", this.presentation.detailsVisible && !this.presentation.fullView);
    this.iconMotion.cancel();
    this.root.innerHTML = renderShell(this.store, this.presentation);
    const sidebar = this.root.querySelector(".sidebar-scroll");
    const tabs = this.root.querySelector(".tab-scroll");
    if (sidebar instanceof HTMLElement) sidebar.scrollTop = this.sidebarScroll.get(sidebar.dataset.scrollKey!) ?? 0;
    if (tabs) tabs.scrollLeft = tabsScroll;
    const focus = focusId ?? previous;
    if (focus) (this.root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focus)}"]`) ?? this.root.querySelector<HTMLElement>(".is-selected .tab-target"))?.focus({ preventScroll: true });
    if (locateActive) {
      const row = this.root.querySelector<HTMLElement>(".sidebar .activity-row.is-active .activity-open, .sidebar .navigation-row.is-active .row-main");
      if (row?.getClientRects().length) row.scrollIntoView({ block: "nearest" });
    }
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
    tabs?.classList.toggle("has-overflow", tabs.scrollWidth > tabs.clientWidth + 1);
  }

  private toggleDetails(): void {
    this.overlays.close(false);
    if (this.presentation.fullView) {
      this.presentation.fullView = false;
      this.presentation.detailsVisible = true;
    } else this.presentation.detailsVisible = !this.presentation.detailsVisible;
    this.render("toggle-details");
  }

  private toggleFullView(): void {
    this.overlays.close(false);
    if (!this.presentation.fullView && !this.presentation.detailsVisible) return;
    this.presentation.fullView = !this.presentation.fullView;
    this.render("toggle-full-view");
  }

  private open(id: string, focusTab = false): void {
    if (id === "archive") { this.actions.archiveDialog(); return; }
    if (id === "lumia") { this.continueCompanion(id); return; }
    if (!this.store.open(id)) return;
    this.render(focusTab ? `tab-${id}` : undefined, true);
  }

  private closeTab(id: string): void {
    this.closeTabs([id]);
  }

  private closeTabs(ids: string[]): void {
    if (!this.store.closeMany(ids)) return;
    this.render(`tab-${this.store.state.activeId}`, true);
  }

  private toggleSidebar(): void {
    this.store.state.sidebarVisible = !this.store.state.sidebarVisible;
    this.store.persist();
    this.render();
  }

  private toggleActivity(): void {
    this.overlays.close(false);
    this.store.toggleActivity();
    this.render("activity-toggle");
  }

  private activityOptions(anchor: HTMLElement): void {
    this.overlays.menu(anchor, [
      { label: "全部会话", selected: this.store.state.activityFilter === "all", run: () => { this.store.setActivityFilter("all"); this.render("activity-options"); } },
      { label: "只看未读", selected: this.store.state.activityFilter === "unread", run: () => { this.store.setActivityFilter("unread"); this.render("activity-options"); } },
      { label: "全部标为已读", icon: "check", separatorBefore: true, disabled: unreadSessionCount(this.store.state) === 0, run: () => { this.store.markAllSessionsRead(); this.render("activity-options"); } },
    ], "会话活动");
  }

  private navigate(mode: NavigationMode): void {
    this.store.navigate(mode);
    this.render(`rail-${mode}`, true);
  }

  private continueCompanion(id?: string): void {
    if (id && !companionById(id)) return;
    if (id) this.store.selectCompanion(id);
    const conversation = conversationForCompanion(this.store.state);
    if (!this.store.state.activityVisible) this.store.navigate("chat");
    if (conversation) {
      this.store.open(conversation.id);
      this.render(`open-activity-${conversation.id}`, true);
    } else {
      this.render("companion-continue");
      this.actions.newItem("conversation");
    }
  }

  private dragDestination(source: DragRef, target: DragTarget): { beforeId?: string; groupId?: string } | undefined {
    const before = (ids: string[]): { beforeId?: string } | undefined => {
      if (!target.id || !ids.includes(source.id) || !ids.includes(target.id) || source.id === target.id || target.placement === "inside") return;
      const peers = ids.filter((id) => id !== source.id);
      return { beforeId: target.placement === "before" ? target.id : peers[peers.indexOf(target.id) + 1] };
    };
    const state = this.store.state;
    if (source.kind === "rail" && target.kind === "rail") return before(state.railOrder);
    if (source.kind === "tab" && target.kind === "tab") return before(state.tabs);
    if (source.kind === "favorite" && target.kind === "favorite") return before(state.favorites);
    if (source.kind === "group" && target.kind === "group") {
      const group = state.groups.find((entry) => entry.id === source.id);
      return group ? before(state.groups.filter((entry) => entry.kind === group.kind).map((entry) => entry.id)) : undefined;
    }
    if (source.kind !== "item") return;
    const item = state.items.find((entry) => entry.id === source.id);
    const targetItem = target.kind === "item" ? state.items.find((entry) => entry.id === target.id) : undefined;
    const groupId = targetItem?.groupId ?? (target.kind === "group" ? target.id : target.kind === "group-content" ? target.groupId : undefined);
    const group = state.groups.find((entry) => entry.id === groupId);
    if (!item || !group || (item.kind === "coding" && group.kind !== "project")) return;
    if ((target.kind === "group" || target.kind === "group-content") && target.placement === "inside") return { groupId };
    if (!targetItem || targetItem.id === item.id || target.placement === "inside") return;
    const peers = state.items.filter((entry) => entry.groupId === groupId && entry.id !== source.id);
    return { groupId, beforeId: target.placement === "before" ? targetItem.id : peers[peers.indexOf(targetItem) + 1]?.id };
  }

  private drop(source: DragRef, target: DragTarget): boolean {
    const destination = this.dragDestination(source, target);
    if (!destination) return false;
    const { beforeId, groupId } = destination;
    if (source.kind === "rail") return this.store.reorderRail(source.id as NavigationMode, beforeId as NavigationMode | undefined);
    if (source.kind === "tab") return this.store.reorderTab(source.id, beforeId);
    if (source.kind === "group") return this.store.reorderGroup(source.id, beforeId);
    if (source.kind === "favorite") return this.store.reorderFavorite(source.id, beforeId);
    if (!groupId) return false;
    const moved = this.store.reorderItem(source.id, beforeId, groupId);
    if (moved && !this.store.state.expanded.includes(groupId)) this.store.toggleGroup(groupId);
    return moved;
  }

  private navigationSettings(anchor: HTMLElement): void {
    this.overlays.menu(anchor, [
      { label: this.store.state.sidebarVisible ? "收起侧栏" : "展开侧栏", icon: "sidebar", shortcut: "⌘B", run: () => this.toggleSidebar() },
      { label: "恢复默认侧栏宽度", run: () => this.setWidth(232) },
      { label: "恢复导航顺序", run: () => { this.store.state.railOrder = [...defaultRailOrder]; this.store.persist(); this.render("navigation-settings"); } },
    ], "侧栏布局");
  }

  private createForNavigation(): void {
    const kind = sidebarCreationKind(this.store.state);
    if (kind) this.actions.newItem(kind);
  }

  private click(event: MouseEvent): void {
    const target = (event.target as Element).closest<HTMLButtonElement>("button[data-action]");
    if (!target || target.disabled) return;
    const activation = this.iconMotion.capture(this.root, target);
    const id = target.dataset.id ?? "";
    switch (target.dataset.action) {
      case "open": this.open(id); break;
      case "companion": this.continueCompanion(); break;
      case "companion-menu": this.companions.menu(target); break;
      case "navigation-settings": this.navigationSettings(target); break;
      case "navigate": if (navigationModes.includes(id as NavigationMode)) this.navigate(id as NavigationMode); break;
      case "feature-menu": this.features.menu(target); break;
      case "feature-open": this.features.open(id); break;
      case "close-tab": this.closeTab(id); break;
      case "toggle-group": this.store.toggleGroup(id); this.render(); break;
      case "locate-group": if (this.store.locateGroup(id, true)) this.render(`group-${id}`, true); break;
      case "toggle-section": this.store.toggleSection(id); this.render(); break;
      case "toggle-sidebar": this.toggleSidebar(); break;
      case "toggle-activity": this.toggleActivity(); break;
      case "activity-options": this.activityOptions(target); break;
      case "activity-all": this.store.setActivityFilter("all"); this.render("activity-options"); break;
      case "back": this.store.travel(-1); this.render(undefined, true); break;
      case "forward": this.store.travel(1); this.render(undefined, true); break;
      case "search": this.actions.search(); break;
      case "new-tab": this.actions.newMenu(target); break;
      case "tab-overflow": openedTabsMenu(target, this.store, this.overlays, (id) => this.open(id, true)); break;
      case "content-menu": contentMenu(target, this.store, this.actions, this.overlays, () => this.render()); break;
      case "toggle-details": this.toggleDetails(); break;
      case "toggle-full-view": this.toggleFullView(); break;
      case "sidebar-create": this.createForNavigation(); break;
      case "export-recovery": this.actions.exportRecovery(); break;
      case "add-group": this.actions.newGroup(target.dataset.kind as GroupKind); break;
      case "create-in-group": this.actions.newItem(target.dataset.kind === "coding" ? "coding" : "page", id); break;
      case "item-menu": this.actions.itemMenu(id, target); break;
      case "group-menu": this.actions.groupMenu(id, target); break;
      case "account-menu": this.actions.accountMenu(target); break;
    }
    this.iconMotion.play(this.root, activation);
  }

  private middleTabClick(event: MouseEvent): void {
    if (event.button !== 1) return;
    const tab = (event.target as Element).closest<HTMLElement>("[data-context-tab]");
    if (!tab) return;
    event.preventDefault();
    this.overlays.close(false);
    this.closeTab(tab.dataset.contextTab!);
  }

  private contextMenu(event: MouseEvent): void {
    if (this.actions.openContextMenu(event.target as Element, { x: event.clientX, y: event.clientY })) event.preventDefault();
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
    if (event.isComposing || event.defaultPrevented) return;
    if (event.key === "Escape" && this.overlays.overlay) { event.preventDefault(); this.overlays.close(); return; }
    if (this.overlays.overlay instanceof HTMLDialogElement) return;
    if (event.key === "Escape" && this.presentation.fullView) { event.preventDefault(); this.toggleFullView(); return; }
    if (event.key === "Escape" && this.presentation.detailsVisible) { event.preventDefault(); this.toggleDetails(); return; }
    const target = event.target as HTMLElement;
    if ((event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) && !event.ctrlKey && !event.metaKey && !event.altKey && this.actions.openContextMenu(target)) {
      event.preventDefault();
      return;
    }
    const menuTrigger = target.closest<HTMLButtonElement>('button[aria-haspopup="menu"]');
    if (menuTrigger && !menuTrigger.disabled && ["ArrowDown", "ArrowUp"].includes(event.key) && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (!this.overlays.overlay || this.overlays.menuAnchor !== menuTrigger) menuTrigger.click();
      if (this.overlays.overlay && !(this.overlays.overlay instanceof HTMLDialogElement)) {
        const buttons = [...this.overlays.overlay.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        (event.key === "ArrowUp" ? buttons.at(-1) : buttons[0])?.focus();
      }
      return;
    }
    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (modifier && event.shiftKey && key === "f" && !event.altKey) { event.preventDefault(); this.toggleFullView(); return; }
    if (modifier && event.altKey && (event.code === "KeyU" || key === "u") && !event.shiftKey) { event.preventDefault(); this.toggleActivity(); return; }
    if (modifier && ["t", "n", "w", "k", "b"].includes(key)) {
      event.preventDefault();
      if (key === "t") {
        if (event.shiftKey) {
          this.overlays.close();
          this.actions.restoreClosedTab();
        }
        else {
          const trigger = this.root.querySelector<HTMLElement>('[data-focus="chrome-create"]');
          if (trigger) this.actions.newMenu(trigger);
        }
      }
      if (key === "n") this.createForNavigation();
      if (key === "w") { this.overlays.close(); this.closeTab(this.store.state.activeId); }
      if (key === "k") this.actions.search();
      if (key === "b") { this.overlays.close(); this.toggleSidebar(); }
      return;
    }
    const editable = target.matches("input, textarea, select") || target.isContentEditable;
    if (!editable && event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); this.overlays.close(); this.store.travel(event.key === "ArrowLeft" ? -1 : 1); this.render(undefined, true); return; }
    if (target.classList.contains("sidebar-resizer") && ["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) { event.preventDefault(); this.setWidth(event.key === "Home" ? 232 : this.store.state.sidebarWidth + (event.key === "ArrowRight" ? 8 : -8)); return; }
    if ((target.getAttribute("role") === "tab" && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) || (event.ctrlKey && event.key === "Tab")) {
      event.preventDefault();
      const tabs = this.store.state.tabs;
      const index = tabs.indexOf(target.getAttribute("role") === "tab" ? target.dataset.id! : this.store.state.activeId);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowLeft" || event.shiftKey ? -1 : 1) + tabs.length) % tabs.length;
      this.overlays.close();
      this.open(tabs[next], true);
    }
  }
}
