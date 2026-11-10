import { icon } from "./icons";
import { escapeHtml, itemIcon } from "./view-shared";
import { openedTabEntries } from "./tab-model";
import type { ShellOverlays } from "./overlays";
import type { WorkspaceStore } from "./state";

interface TabPickerHost { open(id: string): void; close(id: string): void }
interface PickerFocus { id: string; close: boolean }

export class TabPicker {
  constructor(private root: HTMLElement, private store: WorkspaceStore, private overlays: ShellOverlays, private host: TabPickerHost) {}

  show(anchor: HTMLElement, query = "", focus?: PickerFocus, toggle = true): void {
    this.overlays.menu(anchor, [], "打开的标签页", '<div class="tab-picker-results"></div><div class="tab-picker-summary" role="status"></div>', {
      className: "opened-tabs-menu",
      toggle,
      header: `<label class="tab-picker-search">${icon("search")}<input type="search" aria-label="查找打开的标签页" placeholder="查找标签、分组或人物" value="${escapeHtml(query)}" autocomplete="off" spellcheck="false" aria-controls="opened-tab-results" /></label>`,
    });
    const menu = this.overlays.overlay;
    if (!menu?.classList.contains("opened-tabs-menu")) return;
    const input = menu.querySelector<HTMLInputElement>("input")!;
    const results = menu.querySelector<HTMLElement>(".tab-picker-results")!;
    results.id = "opened-tab-results";
    const renderResults = () => {
      const entries = openedTabEntries(this.store.state, input.value);
      results.innerHTML = entries.length ? entries.map(({ item, description, active, closeable }) => `<div class="tab-picker-row ${active ? "is-current" : ""}">
        <button class="tab-picker-open" type="button" role="menuitem" data-tab-picker-open="${escapeHtml(item.id)}" ${active ? 'aria-current="page"' : ""} title="${escapeHtml(`${item.title} · ${description}`)}">${icon(itemIcon(item))}<span class="tab-picker-copy"><span>${escapeHtml(item.title)}</span><small>${escapeHtml(description)}</small></span>${active ? icon("check", "tab-picker-check") : ""}</button>
        ${closeable ? `<button class="tab-picker-close" type="button" data-tab-picker-close="${escapeHtml(item.id)}" aria-label="关闭${escapeHtml(item.title)}的标签页" title="关闭标签，保留内容">${icon("close")}</button>` : ""}
      </div>`).join("") : '<p class="tab-picker-empty">没有匹配的标签页</p>';
      menu.querySelector<HTMLElement>(".tab-picker-summary")!.textContent = `${entries.length} / ${this.store.state.tabs.length} 个标签页`;
    };
    renderResults();
    input.addEventListener("input", renderResults);
    menu.addEventListener("click", (event) => {
      const target = (event.target as Element).closest<HTMLButtonElement>("[data-tab-picker-open], [data-tab-picker-close]");
      if (!target) return;
      const id = target.dataset.tabPickerOpen ?? target.dataset.tabPickerClose!;
      if (!this.store.state.tabs.includes(id)) return;
      const current = openedTabEntries(this.store.state, input.value);
      const index = current.findIndex((entry) => entry.item.id === id);
      const query = input.value;
      this.overlays.close(false);
      if (target.dataset.tabPickerOpen) { this.host.open(id); return; }
      this.host.close(id);
      const liveAnchor = this.root.querySelector<HTMLElement>('[data-focus="tab-overflow"]');
      const next = openedTabEntries(this.store.state, query);
      const neighbor = next[Math.min(index, next.length - 1)];
      if (liveAnchor) this.show(liveAnchor, query, neighbor ? { id: neighbor.item.id, close: true } : undefined, false);
    });
    menu.addEventListener("keydown", (event) => this.keydown(event, menu, input), true);
    const preferred = focus ? menu.querySelector<HTMLElement>(`[data-tab-picker-${focus.close ? "close" : "open"}="${CSS.escape(focus.id)}"]`) ?? menu.querySelector<HTMLElement>(`[data-tab-picker-open="${CSS.escape(focus.id)}"]`) : null;
    (preferred ?? input).focus({ preventScroll: true });
    preferred?.scrollIntoView({ block: "nearest" });
  }

  private keydown(event: KeyboardEvent, menu: HTMLElement, input: HTMLInputElement): void {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement;
    const buttons = [...menu.querySelectorAll<HTMLButtonElement>("[data-tab-picker-open]")];
    if (target === input && ["Home", "End", "ArrowLeft", "ArrowRight"].includes(event.key)) { event.stopPropagation(); return; }
    if (target === input && event.key === "Enter") {
      event.preventDefault(); event.stopPropagation();
      (buttons.find((button) => button.getAttribute("aria-current") === "page") ?? buttons[0])?.click();
      return;
    }
    const row = target.closest(".tab-picker-row");
    const current = row?.querySelector<HTMLButtonElement>("[data-tab-picker-open]");
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (!buttons.length) { input.focus(); return; }
      const index = current ? buttons.indexOf(current) : event.key === "ArrowUp" ? 0 : -1;
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
      buttons[next].scrollIntoView({ block: "nearest" });
    } else if (row && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      (event.key === "ArrowRight" ? row.querySelector<HTMLButtonElement>("[data-tab-picker-close]") ?? current : current)?.focus();
    }
  }
}
