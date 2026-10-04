import { collectionSchemas, fieldDefaults } from "./configuration-contract";
import type { ConfigurationCollection, ConfigurationValues } from "./configuration-types";
import type { ConfigurationStore } from "./configuration-store";
import type { ShellOverlays } from "./overlays";
import { escapeHtml } from "./view-shared";
import { configurationControl } from "./settings-form-view";

interface RecordHost { changed(message: string, focus?: string): void }

export class ConfigurationRecordActions {
  constructor(private store: ConfigurationStore, private overlays: ShellOverlays, private host: RecordHost) {}

  edit(collection: ConfigurationCollection, id?: string): void {
    const schema = collectionSchemas[collection];
    const existing = id ? this.store.data.collections[collection].find((record) => record.id === id) : undefined;
    if (id && !existing) return;
    const initial = existing?.values ?? fieldDefaults(schema.fields);
    const base = JSON.stringify(existing?.values);
    const dialog = this.overlays.dialog(`<form class="configuration-record-form"><h2 class="dialog-heading" id="dialog-title">${id ? "编辑" : "添加"}${schema.singular}</h2><p class="settings-block-description">${schema.description}</p>${schema.fields.map((field) => `<label class="configuration-record-field" for="config-${field.key}"><span>${field.label}</span><small>${field.hint}</small>${configurationControl(field, initial, "")}</label>`).join("")}<p class="settings-field-error" role="alert" data-record-error hidden></p><div class="dialog-actions"><button class="text-button" type="button" data-dismiss>取消</button><button class="primary-button" type="submit">保存配置</button></div></form>`, "configuration-record-dialog");
    const form = dialog.querySelector<HTMLFormElement>("form")!;
    const error = dialog.querySelector<HTMLElement>("[data-record-error]")!;
    const transport = form.elements.namedItem("transport") as HTMLSelectElement | null;
    const kind = form.elements.namedItem("kind") as HTMLSelectElement | null;
    const refreshTransport = () => {
      if (!transport) return;
      if (kind?.value === "skill") transport.value = "stdio";
      transport.disabled = kind?.value === "skill";
      const remote = transport.value === "http";
      for (const key of ["command", "endpoint"]) {
        const input = form.elements.namedItem(key) as HTMLInputElement;
        input.closest<HTMLElement>(".configuration-record-field")!.hidden = remote ? key === "command" : key === "endpoint";
        input.disabled = remote ? key === "command" : key === "endpoint";
      }
    };
    transport?.addEventListener("change", refreshTransport);
    kind?.addEventListener("change", refreshTransport);
    refreshTransport();
    form.addEventListener("input", () => { error.hidden = true; form.querySelectorAll("[aria-invalid]").forEach((element) => element.removeAttribute("aria-invalid")); });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (id && JSON.stringify(this.store.data.collections[collection].find((record) => record.id === id)?.values) !== base) {
        error.textContent = "配置已被其他窗口更改，请取消并重新打开。"; error.hidden = false; return;
      }
      const data = new FormData(form);
      const values: ConfigurationValues = Object.fromEntries(schema.fields.map((field) => [field.key, String(data.get(field.key) ?? (field.key === "transport" && kind?.value === "skill" ? "stdio" : ""))]));
      const errors = this.store.saveRecord(collection, values, id);
      if (errors) {
        error.textContent = Object.entries(errors).map(([key, message]) => `${schema.fields.find((field) => field.key === key)?.label ?? "配置"}：${message}`).join(" ");
        error.hidden = false;
        const field = form.elements.namedItem(Object.keys(errors)[0]) as HTMLElement | null;
        field?.setAttribute("aria-invalid", "true"); field?.focus(); return;
      }
      this.overlays.close(false);
      this.host.changed("配置已保存；执行服务尚未接入。", id ? `configuration-edit-${id}` : `configuration-add-${collection}`);
    });
    form.querySelector<HTMLInputElement>('input[name="name"]')!.focus();
  }

  remove(collection: ConfigurationCollection, id: string): void {
    const record = this.store.data.collections[collection].find((item) => item.id === id);
    if (!record) return;
    const dialog = this.overlays.dialog(`<h2 class="dialog-heading" id="dialog-title">删除${collectionSchemas[collection].singular}</h2><p class="settings-confirm-copy">删除「${escapeHtml(String(record.values.name))}」的本机配置？${collection === "models" ? "引用它的 Agent 和 Coding 默认模型会一并取消指定。" : ""}</p><div class="dialog-actions"><button class="text-button" type="button" data-dismiss autofocus>取消</button><button class="primary-button" type="button" data-confirm-remove>删除配置</button></div>`, "configuration-confirm-dialog");
    dialog.querySelector("[data-confirm-remove]")!.addEventListener("click", () => {
      if (!this.store.removeRecord(collection, id)) return;
      this.overlays.close(false);
      this.host.changed("已删除配置。", `configuration-add-${collection}`);
    });
  }
}
