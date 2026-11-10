import type { WorkspaceStore } from "./state";
import { canDeleteContent } from "./workspace-lifecycle";
import type { RestoreResult } from "./workspace-lifecycle";
import { snapshotTitle } from "./lifecycle-view";
import type { CollectionKind } from "./lifecycle-view";
import type { MenuEntry, ShellOverlays } from "./overlays";
import type { NoticeActions } from "./shell-notice";
import { escapeHtml, iconButton } from "./view-shared";

interface LifecycleHost {
  render(focusId?: string, locateActive?: boolean): void;
  open(id: string, focusTab?: boolean): void;
  notify(message: string, actions?: NoticeActions): void;
  clearNotice(): void;
  openCollection(collection: CollectionKind, focus?: string): void;
  collectionFeedback(message: string): boolean;
}

export class LifecycleActions {
  private queries: Record<CollectionKind, string> = { archive: "", trash: "" };

  constructor(private store: WorkspaceStore, private overlays: ShellOverlays, private host: LifecycleHost) {}

  menuEntries(target: "item" | "group", id: string): MenuEntry[] {
    const group = target === "group" ? this.store.state.groups.find((entry) => entry.id === id) : undefined;
    const items = this.store.state.items.filter((entry) => target === "item" ? entry.id === id : entry.groupId === id);
    const suffix = group ? group.kind === "project" ? "项目" : "空间" : "";
    const allowed = canDeleteContent(items);
    return [
      { label: `归档${suffix}`, icon: "archive", separatorBefore: true, run: () => target === "group" ? this.archiveGroup(id) : this.archiveItem(id) },
      { label: `删除${suffix}`, icon: "trash", danger: true, disabled: !allowed, status: allowed ? undefined : "请先结束执行", run: () => this.delete(target, id) },
    ];
  }

  showCollection(collection: CollectionKind = "archive"): void {
    this.host.clearNotice();
    this.host.openCollection(collection);
  }

  bindCollection(element: HTMLElement, collection: CollectionKind): void {
    const filter = () => {
      const input = element.querySelector<HTMLInputElement>("[data-collection-search]");
      if (!input) return;
      if (input.value !== this.queries[collection]) input.value = this.queries[collection];
      const query = input.value.trim().toLocaleLowerCase();
      const rows = [...element.querySelectorAll<HTMLElement>("[data-collection-entry]")];
      let matches = 0;
      for (const row of rows) {
        row.hidden = !(row.dataset.searchText ?? "").toLocaleLowerCase().includes(query);
        if (!row.hidden) matches++;
      }
      element.querySelector<HTMLElement>("[data-collection-empty]")!.hidden = matches > 0;
      element.querySelector<HTMLElement>("[data-collection-total]")!.textContent = query ? `${matches} / ${rows.length} 项` : `${rows.length} 项`;
    };
    element.addEventListener("input", (event) => {
      const input = event.target as HTMLInputElement;
      if (!input.matches("[data-collection-search]")) return;
      this.queries[collection] = input.value;
      filter();
    });
    element.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-collection-action]");
      const id = button?.dataset.id;
      if (!button || button.disabled || !id) return;
      if (button.dataset.collectionAction === "restore") {
        const visible = [...element.querySelectorAll<HTMLElement>('[data-collection-entry]:not([hidden])')];
        const index = visible.findIndex((row) => row.dataset.collectionEntry === id);
        const neighbor = (visible[index + 1] ?? visible[index - 1])?.dataset.collectionEntry;
        const result = collection === "archive" ? this.store.restoreArchive(id) : this.store.restoreTrash(id);
        if (!result) { this.feedback("无法恢复此内容，请重新检查记录"); return; }
        this.host.render(neighbor ? `restore-${collection}-${neighbor}` : this.store.state[collection === "archive" ? "archives" : "trash"].length ? `collection-search-${collection}` : "settings-heading");
        this.feedback(result.archiveId ? "已恢复至归档" : "已恢复到原位置");
      } else if (button.dataset.collectionAction === "delete") this.delete("archive", id, "archive");
    });
    filter();
  }

  archiveItem(id: string): void {
    const item = this.store.state.items.find((entry) => entry.id === id);
    if (!item) return;
    const record = this.store.archiveItem(id);
    if (!record) return;
    this.host.render(`tab-${this.store.state.activeId}`, true);
    this.feedback(`已归档「${item.title}」`, { undo: () => this.restore("archive", record), view: { label: "查看归档", run: () => this.showCollection("archive") } });
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
      this.feedback(`已归档「${group.title}」`, { undo: () => this.restore("archive", record), view: { label: "查看归档", run: () => this.showCollection("archive") } });
    });
    dialog.querySelector<HTMLButtonElement>(".text-button[data-dismiss]")!.focus();
  }

  delete(target: "item" | "group" | "archive", id: string, returnTo?: CollectionKind): void {
    const state = this.store.state;
    const group = target === "group" ? state.groups.find((entry) => entry.id === id) : undefined;
    const item = target === "item" ? state.items.find((entry) => entry.id === id) : undefined;
    const archived = target === "archive" ? state.archives.find((entry) => entry.id === id) : undefined;
    if (!group && !item && !archived) return;
    const items = archived?.items ?? (group ? state.items.filter((entry) => entry.groupId === id) : [item!]);
    if (!canDeleteContent(items)) { this.feedback("请先结束会话执行，再删除内容"); return; }
    const title = group?.title ?? item?.title ?? snapshotTitle(archived!);
    const grouped = !!group || archived?.target === "group";
    const description = `「${escapeHtml(title)}」${grouped ? `及其中 ${items.length} 条内容` : ""}将移入回收站，可随时恢复${archived ? "至归档" : "到原位置"}。`;
    const cancel = () => { this.overlays.close(); if (returnTo) this.host.openCollection(returnTo, `collection-search-${returnTo}`); };
    const dialog = this.overlays.dialog(`<form><h2 class="dialog-heading" id="dialog-title">删除${grouped ? "分组" : "内容"}${iconButton("close", "关闭", "cancel-delete", "data-cancel-delete")}</h2><p class="move-item-title">${description}</p><div class="dialog-actions"><button type="button" class="text-button" data-cancel-delete>取消</button><button type="submit" class="primary-button danger-button">移入回收站</button></div></form>`, "", cancel);
    dialog.querySelectorAll("[data-cancel-delete]").forEach((button) => button.addEventListener("click", cancel));
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); cancel(); });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
    });
    dialog.querySelector("form")!.addEventListener("submit", (event) => {
      event.preventDefault();
      const record = target === "group" ? this.store.deleteGroup(id) : target === "archive" ? this.store.deleteArchive(id) : this.store.deleteItem(id);
      if (!record) { cancel(); this.feedback("内容状态已变化，未执行删除"); return; }
      this.overlays.close(false);
      if (returnTo) this.host.openCollection(returnTo, `collection-search-${returnTo}`);
      else this.host.render(`tab-${this.store.state.activeId}`, true);
      this.feedback(`已删除「${title}」`, { undo: () => this.restore("trash", record), view: { label: "查看回收站", run: () => this.showCollection("trash") } });
    });
    dialog.querySelector<HTMLButtonElement>(".text-button[data-cancel-delete]")!.focus();
  }

  private restore(collection: CollectionKind, id: string): void {
    const result: RestoreResult | undefined = collection === "archive" ? this.store.restoreArchive(id) : this.store.restoreTrash(id);
    if (!result) { this.host.notify("此记录已恢复或不存在"); return; }
    this.overlays.close(false);
    if (result.archiveId) { this.host.render(); this.showCollection("archive"); }
    else if (result.itemId) this.host.open(result.itemId, true);
    else if (result.groupId) { this.store.locateGroup(result.groupId); this.host.render(`group-${result.groupId}`, true); }
    else this.host.render();
    this.feedback(result.archiveId ? "已恢复至归档" : "已恢复到原位置");
  }

  private feedback(message: string, actions?: NoticeActions): void {
    const text = this.store.storageAvailable ? message : `${message}；保存失败，本次更改尚未落盘`;
    if (!this.host.collectionFeedback(text)) this.host.notify(text, actions);
  }
}
