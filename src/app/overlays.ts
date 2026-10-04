import { icon } from "./icons";
import type { IconName } from "./icons";
import { escapeHtml, iconButton } from "./view-shared";

export interface MenuEntry {
  label: string;
  icon?: IconName;
  shortcut?: string;
  disabled?: boolean;
  separatorBefore?: boolean;
  selected?: boolean;
  description?: string;
  status?: string;
  submenu?: MenuEntry[];
  pin?: { label: string; pressed: boolean; disabled?: boolean; run: () => void };
  run: () => void;
}

export interface FocusTarget { element: HTMLElement; key?: string }
export interface MenuPoint { x: number; y: number }
export interface MenuOptions { point?: MenuPoint; toggle?: boolean; className?: string; header?: string }

export class ShellOverlays {
  overlay: HTMLElement | null = null;
  overlayReturnFocus: FocusTarget | null = null;
  menuAnchor: HTMLElement | null = null;
  constructor(private root: HTMLElement) {}

  menu(anchor: HTMLElement | MenuPoint, entries: MenuEntry[], heading?: string, extra = "", options: MenuOptions = {}): void {
    if (options.toggle !== false && anchor instanceof HTMLElement && this.overlay && this.menuAnchor === anchor) { this.close(); return; }
    this.close();
    const returnFocus = anchor instanceof HTMLElement ? anchor : document.activeElement;
    if (returnFocus instanceof HTMLElement) this.overlayReturnFocus = { element: returnFocus, key: returnFocus.dataset.focus };
    this.menuAnchor = anchor instanceof HTMLElement ? anchor : null;
    const menu = document.createElement("div");
    menu.id = "shell-menu";
    menu.tabIndex = -1;
    menu.className = `floating-menu${options.className ? ` ${options.className}` : ""}`;
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", heading ?? "操作菜单");
    const entriesMarkup = (items: MenuEntry[], nested = false) => items.map((entry, index) => {
      const label = entry.description ? `${entry.label} · ${entry.description}` : entry.label;
      const main = `<button type="button" class="menu-item ${entry.selected ? "is-current" : ""}" role="menuitem" ${nested ? "data-submenu-index" : "data-menu-index"}="${index}" title="${escapeHtml(label)}" ${entry.submenu ? 'aria-haspopup="menu" aria-expanded="false"' : ""} ${entry.selected ? 'aria-current="page"' : ""} ${entry.disabled ? "disabled" : ""}>
        <span class="menu-glyph" aria-hidden="true">${entry.icon ? icon(entry.icon) : ""}</span>
        <span class="menu-copy"><span class="menu-title">${escapeHtml(entry.label)}</span>${entry.description ? `<small>${escapeHtml(entry.description)}</small>` : ""}</span>
        ${entry.status ? `<span class="menu-status">${escapeHtml(entry.status)}</span>` : ""}${entry.shortcut ? `<span class="menu-shortcut">${entry.shortcut}</span>` : ""}
        ${entry.submenu ? `<span class="menu-chevron" aria-hidden="true">${icon("right")}</span>` : ""}${entry.selected ? `<span class="menu-check" aria-hidden="true">${icon("check")}</span>` : ""}
      </button>`;
      const pin = entry.pin && !nested ? `<button type="button" class="menu-pin" role="menuitemcheckbox" data-menu-pin="${index}" aria-label="${escapeHtml(entry.pin.label)}" title="${escapeHtml(entry.pin.label)}" aria-checked="${entry.pin.pressed}" ${entry.pin.disabled ? "disabled" : ""}>${icon("pin", "", entry.pin.pressed ? "active" : "outline")}</button>` : "";
      return `${entry.separatorBefore ? '<div class="menu-rule" role="separator"></div>' : ""}${main}${pin}`;
    }).join("");
    menu.innerHTML = `${options.header ?? (heading ? `<div class="menu-label">${escapeHtml(heading)}</div>` : "")}${entriesMarkup(entries)}${extra}`;
    document.body.append(menu);
    let point = options.point ?? (anchor instanceof HTMLElement ? { x: anchor.getBoundingClientRect().left, y: anchor.getBoundingClientRect().bottom + 5 } : anchor);
    if (anchor instanceof HTMLElement && !options.point) {
      const bounds = anchor.getBoundingClientRect();
      const below = window.innerHeight - bounds.bottom - 13;
      const above = bounds.top - 13;
      const openAbove = menu.offsetHeight > below && above > below;
      // Constrain long menus to the available side rather than covering their trigger.
      menu.style.maxHeight = `${Math.max(0, openAbove ? above : below)}px`;
      if (openAbove) point = { x: bounds.left, y: bounds.top - menu.offsetHeight - 5 };
    }
    menu.style.left = `${Math.max(8, Math.min(point.x, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(point.y, window.innerHeight - menu.offsetHeight - 8))}px`;
    this.overlay = menu;
    if (this.menuAnchor?.getAttribute("aria-haspopup") === "menu") {
      this.menuAnchor.setAttribute("aria-expanded", "true");
      this.menuAnchor.setAttribute("aria-controls", menu.id);
    }
    let childMenu: HTMLElement | null = null;
    let childAnchor: HTMLElement | null = null;
    const closeSubmenu = (restoreFocus = false) => {
      const trigger = childAnchor;
      childMenu?.remove();
      childMenu = null;
      childAnchor = null;
      trigger?.setAttribute("aria-expanded", "false");
      trigger?.removeAttribute("aria-controls");
      if (restoreFocus) trigger?.focus();
    };
    const openSubmenu = (trigger: HTMLElement, entry: MenuEntry, focus = false) => {
      if (!entry.submenu?.length) return;
      if (childAnchor !== trigger) {
        closeSubmenu();
        childAnchor = trigger;
        childMenu = document.createElement("div");
        childMenu.id = "shell-submenu";
        childMenu.className = "floating-menu menu-submenu";
        childMenu.setAttribute("role", "menu");
        childMenu.setAttribute("aria-label", entry.label);
        childMenu.innerHTML = entriesMarkup(entry.submenu, true);
        menu.append(childMenu);
        trigger.setAttribute("aria-expanded", "true");
        trigger.setAttribute("aria-controls", childMenu.id);
        const parent = menu.getBoundingClientRect();
        const row = trigger.getBoundingClientRect();
        const right = parent.right + 5;
        childMenu.style.left = `${Math.max(8, Math.min(right + childMenu.offsetWidth <= window.innerWidth - 8 ? right : parent.left - childMenu.offsetWidth - 5, window.innerWidth - childMenu.offsetWidth - 8))}px`;
        childMenu.style.top = `${Math.max(8, Math.min(row.top, window.innerHeight - childMenu.offsetHeight - 8))}px`;
      }
      if (focus) childMenu?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    };
    menu.addEventListener("pointerover", (event) => {
      const hit = event.target as Element;
      if (hit.closest(".menu-submenu")) return;
      const trigger = hit.closest<HTMLElement>("[data-menu-index]");
      if (!trigger) return;
      const entry = entries[Number(trigger.dataset.menuIndex)];
      if (entry?.submenu && !entry.disabled) openSubmenu(trigger, entry);
      else closeSubmenu();
    });
    menu.addEventListener("click", (event) => {
      const pinButton = (event.target as Element).closest<HTMLElement>("[data-menu-pin]");
      if (pinButton) {
        const pin = entries[Number(pinButton.dataset.menuPin)]?.pin;
        if (!pin || pin.disabled) return;
        this.close(false);
        pin.run();
        return;
      }
      const childButton = (event.target as Element).closest<HTMLElement>("[data-submenu-index]");
      if (childButton && childAnchor) {
        const entry = entries[Number(childAnchor.dataset.menuIndex)].submenu?.[Number(childButton.dataset.submenuIndex)];
        if (!entry || entry.disabled) return;
        this.close();
        entry.run();
        return;
      }
      const button = (event.target as Element).closest<HTMLElement>("[data-menu-index]");
      if (!button) return;
      const entry = entries[Number(button.dataset.menuIndex)];
      if (!entry || entry.disabled) return;
      if (entry.submenu) { openSubmenu(button, entry, true); return; }
      this.close();
      entry.run();
    });
    menu.addEventListener("keydown", (event) => {
      const inChild = childMenu?.contains(event.target as Node) ?? false;
      if (inChild && ["ArrowLeft", "Escape"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        closeSubmenu(true);
        return;
      }
      const trigger = (event.target as Element).closest<HTMLElement>("[data-menu-index]");
      const pinTrigger = (event.target as Element).closest<HTMLElement>("[data-menu-pin]");
      if (pinTrigger && event.key === "ArrowLeft") {
        event.preventDefault();
        menu.querySelector<HTMLElement>(`[data-menu-index="${pinTrigger.dataset.menuPin}"]`)?.focus();
        return;
      }
      if (!inChild && trigger && event.key === "ArrowRight") {
        const entry = entries[Number(trigger.dataset.menuIndex)];
        if (entry?.submenu) { event.preventDefault(); openSubmenu(trigger, entry, true); }
        else if (entry?.pin) {
          event.preventDefault();
          menu.querySelector<HTMLElement>(`[data-menu-pin="${trigger.dataset.menuIndex}"]:not(:disabled)`)?.focus();
        }
        return;
      }
      const scope = inChild ? childMenu! : menu;
      const buttons = [...scope.querySelectorAll<HTMLButtonElement>(":scope > button:not(:disabled):not([data-menu-pin])")];
      if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) { this.leaveMenu(event); return; }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        if (!buttons.length) return;
        if (!inChild) closeSubmenu();
        const active = pinTrigger ? menu.querySelector<HTMLButtonElement>(`[data-menu-index="${pinTrigger.dataset.menuPin}"]`) : document.activeElement;
        const index = buttons.indexOf(active as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    });
    (menu.querySelector<HTMLElement>("button:not(:disabled)") ?? menu).focus();
  }

  leaveMenu(event: KeyboardEvent): void {
    const anchor = this.overlayReturnFocus?.element;
    const overlay = this.overlay;
    const targets = [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')].filter((element) =>
      !overlay?.contains(element) && !element.closest('[inert]') && !element.matches(':disabled') &&
      (element === anchor || element.tabIndex >= 0) && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden"
    );
    const index = anchor ? targets.indexOf(anchor) : -1;
    const next = index >= 0 ? targets[index + (event.shiftKey ? -1 : 1)] : undefined;
    if (next) {
      event.preventDefault();
      this.close(false);
      next.focus({ preventScroll: true });
    } else {
      // At the document edge, allow the browser to continue to its own chrome.
      this.close();
    }
  }

  dialog(markup: string, className = ""): HTMLDialogElement {
    this.close();
    const returnFocus = document.activeElement;
    if (returnFocus instanceof HTMLElement) this.overlayReturnFocus = { element: returnFocus, key: returnFocus.dataset.focus };
    const dialog = document.createElement("dialog");
    dialog.className = `shell-dialog ${className}`;
    dialog.innerHTML = markup;
    dialog.setAttribute("aria-labelledby", "dialog-title");
    dialog.addEventListener("close", () => { if (this.overlay === dialog) this.close(); else dialog.remove(); });
    dialog.addEventListener("click", (event) => {
      if ((event.target as Element).closest("[data-dismiss]")) this.close();
      if (event.target === dialog) {
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.close();
      }
    });
    document.body.append(dialog);
    this.overlay = dialog;
    dialog.showModal();
    return dialog;
  }

  form(title: string, label: string, value: string, extra: string, onSubmit: (data: FormData) => void): void {
    const dialog = this.dialog(`<form><h2 class="dialog-heading" id="dialog-title">${escapeHtml(title)}${iconButton("close", "关闭", "dismiss", "data-dismiss")}</h2><label class="field-label" for="entry-name">${escapeHtml(label)}</label><input class="text-field" id="entry-name" name="title" required maxlength="72" autocomplete="off" value="${escapeHtml(value)}" autofocus />${extra}<div class="dialog-actions"><button type="button" class="text-button" data-dismiss>取消</button><button type="submit" class="primary-button">${title === "重命名" ? "保存" : "创建"}</button></div></form>`);
    const input = dialog.querySelector<HTMLInputElement>("input")!;
    const fields = [...dialog.querySelectorAll<HTMLInputElement>("input")];
    fields.forEach((field) => field.addEventListener("input", () => field.setCustomValidity("")));
    dialog.querySelector("form")!.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.target as HTMLFormElement);
      for (const field of fields) {
        if (field.disabled) continue;
        const value = String(data.get(field.name) ?? "").trim();
        if (field.required && !value) { field.setCustomValidity("请输入名称"); field.reportValidity(); return; }
        data.set(field.name, value);
      }
      this.close();
      onSubmit(data);
    });
    input.focus();
    input.select();
  }

  close(restoreFocus = true): void {
    const overlay = this.overlay;
    const returnFocus = this.overlayReturnFocus;
    this.overlay = null;
    this.overlayReturnFocus = null;
    if (this.menuAnchor?.getAttribute("aria-haspopup") === "menu") {
      this.menuAnchor.setAttribute("aria-expanded", "false");
      this.menuAnchor.removeAttribute("aria-controls");
    }
    this.menuAnchor = null;
    if (overlay instanceof HTMLDialogElement && overlay.open) overlay.close();
    overlay?.remove();
    if (restoreFocus && returnFocus) {
      const target = returnFocus.element.isConnected ? returnFocus.element : returnFocus.key ? this.root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(returnFocus.key)}"]`) : null;
      (target ?? this.root.querySelector<HTMLElement>(".is-selected .tab-target"))?.focus({ preventScroll: true });
    }
  }

}
