import { ConfigurationStore } from "./configuration-store";
import { configurationSchemas } from "./configuration-contract";
import { configurationCollections, configurationKey } from "./configuration-types";
import type { ConfigurationCollection, ConfigurationDraft, ConfigurationGroup, ConfigurationView } from "./configuration-types";
import { applyAppearance } from "./appearance";
import { ConfigurationRecordActions } from "./configuration-record-actions";
import { ConfigurationTransferActions } from "./configuration-transfer-actions";
import { collectionRecords } from "./settings-collection-view";
import { shortcutRows } from "./settings-personal-view";
import type { WorkspaceStore } from "./state";
import type { ShellOverlays } from "./overlays";

interface ConfigurationHost { render(focus?: string): void; feedback(message: string): boolean }

export class ConfigurationActions {
  readonly store = new ConfigurationStore();
  private drafts: Partial<Record<ConfigurationGroup, ConfigurationDraft>> = {};
  private queries: ConfigurationView["queries"] = {};
  private records: ConfigurationRecordActions;
  private transfers: ConfigurationTransferActions;
  constructor(private root: HTMLElement, workspace: WorkspaceStore, overlays: ShellOverlays, private host: ConfigurationHost) {
    this.records = new ConfigurationRecordActions(this.store, overlays, { changed: (message, focus) => this.changed(message, focus) });
    this.transfers = new ConfigurationTransferActions(this.store, workspace, overlays, {
      render: host.render, message: (message) => this.host.feedback(message), changed: (message, focus) => { this.drafts = {}; this.changed(message, focus); },
    });
    applyAppearance(this.store.data.groups.appearance);
    root.addEventListener("submit", (event) => this.submit(event));
    root.addEventListener("input", (event) => this.input(event));
    root.addEventListener("change", (event) => this.input(event));
    root.addEventListener("click", (event) => this.click(event));
    window.addEventListener("storage", (event) => {
      if (event.key !== configurationKey || !this.store.reload(event.newValue)) return;
      applyAppearance(this.store.data.groups.appearance);
      this.host.render();
      this.host.feedback(Object.keys(this.drafts).length ? "其他窗口已更新设置；你的草稿保留，保存前会检查冲突。" : "已同步其他窗口保存的设置。" );
    });
  }

  get view(): ConfigurationView {
    return { data: this.store.data, drafts: this.drafts, storageAvailable: this.store.storageAvailable, notice: this.store.notice, queries: this.queries, importPreview: this.transfers.preview, importError: this.transfers.error, removedRecord: this.store.removedRecord };
  }

  private changed(message: string, focus?: string): void {
    applyAppearance(this.store.data.groups.appearance);
    this.host.render(focus);
    this.host.feedback(this.store.storageAvailable ? message : this.store.notice);
  }

  private submit(event: Event): void {
    const form = event.target as HTMLFormElement;
    if (!form.dataset.configForm) return;
    event.preventDefault();
    const group = form.dataset.configForm as ConfigurationGroup;
    if (!configurationSchemas.some((schema) => schema.id === group)) return;
    const draft = this.draft(group);
    if (JSON.stringify(draft.base) !== JSON.stringify(this.store.data.groups[group])) {
      draft.errors = { form: "本页配置已被其他窗口修改。请取消更改，读取新值后再编辑。" };
      this.host.render(`configuration-${group}-cancel`); return;
    }
    const errors = this.store.saveGroup(group, draft.values);
    if (errors) { draft.errors = errors; this.host.render(`configuration-${group}-${Object.keys(errors)[0]}`); return; }
    delete this.drafts[group];
    const immediate = configurationSchemas.find((schema) => schema.id === group)!.effect === "immediate";
    this.changed(immediate ? "已保存并应用。" : "默认配置已保存；执行服务尚未接入。", `configuration-${group}-save`);
  }

  private draft(group: ConfigurationGroup): ConfigurationDraft {
    return this.drafts[group] ??= { values: { ...this.store.data.groups[group] }, base: { ...this.store.data.groups[group] }, errors: {} };
  }

  private input(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) return;
    if (input instanceof HTMLInputElement && input.hasAttribute("data-config-import")) {
      if (event.type === "change") void this.transfers.read(input);
      return;
    }
    const filter = input.dataset.configFilter as ConfigurationCollection | "shortcuts" | undefined;
    if (filter) {
      this.queries[filter] = input.value;
      if (filter === "shortcuts") this.root.querySelector("[data-shortcut-list]")!.innerHTML = shortcutRows(input.value);
      else this.root.querySelector(`[data-config-records="${filter}"]`)!.innerHTML = collectionRecords(filter, this.view);
      return;
    }
    if (!input.dataset.configField) return;
    const form = input.closest<HTMLFormElement>("[data-config-form]");
    if (!form) return;
    const group = form.dataset.configForm as ConfigurationGroup;
    const draft = this.draft(group);
    draft.values[input.dataset.configField] = input instanceof HTMLInputElement && input.type === "checkbox" ? input.checked : input.value;
    delete draft.errors[input.dataset.configField];
    input.removeAttribute("aria-invalid");
    form.querySelector<HTMLElement>("[data-config-dirty]")!.textContent = "有未保存的更改";
    if (group === "desktop") {
      const preview = this.root.querySelector<HTMLElement>("[data-companion-preview]");
      if (preview) { preview.style.transform = `scale(${Math.min(2, Math.max(0.5, Number(draft.values.scale) || 1))})`; preview.style.opacity = String(Math.min(100, Math.max(30, Number(draft.values.opacity) || 100)) / 100); }
    }
  }

  private click(event: MouseEvent): void {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-config-action]");
    if (!button || button.disabled) return;
    // WebKit mouse clicks need an explicit focus target for dialog cancellation.
    button.focus({ preventScroll: true });
    const action = button.dataset.configAction;
    const collection = button.dataset.configCollection as ConfigurationCollection;
    if (["add", "edit", "remove", "clear-filter"].includes(action ?? "") && configurationCollections.includes(collection)) {
      if (action === "clear-filter") { this.queries[collection] = ""; this.host.render(`configuration-filter-${collection}`); }
      else if (action === "remove") this.records.remove(collection, button.dataset.configId!);
      else this.records.edit(collection, button.dataset.configId);
    } else if (action === "cancel") {
      const group = button.dataset.configGroup as ConfigurationGroup;
      delete this.drafts[group]; this.host.render(`configuration-${group}-cancel`);
    } else if (action === "retry-configuration") { this.store.persist(); this.changed(this.store.storageAvailable ? "设置已保存。" : this.store.notice, "settings-heading"); }
    else if (action === "cancel-import") this.transfers.cancel();
    else if (action === "apply-import") this.transfers.apply();
    else if (action === "reset-settings") this.transfers.reset();
    else if (action === "undo-remove" && this.store.restoreRemoved()) this.changed("已恢复配置和默认模型引用。", "settings-heading");
    else if (action?.startsWith("export-")) this.transfers.export(action);
  }
}
