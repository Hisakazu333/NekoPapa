import { escapeHtml } from "./view-shared";
import { configurationSchemas } from "./configuration-contract";
import type { ConfigurationView, ConfigurationGroup, ConfigurationField, ConfigurationValues } from "./configuration-types";

export function settingRow(title: string, description: string, control: string): string {
  return `<div class="settings-option"><div class="settings-option-copy"><span>${title}</span><p>${description}</p></div><div class="settings-option-control">${control}</div></div>`;
}

export function configurationControl(field: ConfigurationField, values: ConfigurationValues, attributes: string, error?: string): string {
  const value = values[field.key] ?? field.initial;
  const id = `config-${field.key}`;
  const shared = `id="${id}" name="${field.key}" aria-label="${escapeHtml(field.label)}" ${attributes} ${error ? `aria-invalid="true" aria-describedby="${id}-error"` : ""}`;
  const required = field.required ? "required" : "";
  let control: string;
  if (field.type === "boolean") control = `<label class="settings-switch"><input type="checkbox" ${shared} ${value ? "checked" : ""} /><span aria-hidden="true"></span></label>`;
  else if (field.type === "select") control = `<select class="settings-select" ${shared}>${field.options?.map(([key, label]) => `<option value="${escapeHtml(key)}" ${value === key ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
  else if (field.type === "textarea") control = `<textarea class="settings-textarea" rows="4" maxlength="${field.maxLength}" ${shared} ${required}>${escapeHtml(String(value))}</textarea>`;
  else if (field.type === "number") control = `<input class="settings-input settings-number" type="number" min="${field.min}" max="${field.max}" step="${field.step ?? 1}" value="${value}" ${shared} required />`;
  else control = `<input class="settings-input" type="text" maxlength="${field.maxLength ?? 500}" value="${escapeHtml(String(value))}" autocomplete="off" ${shared} ${required} />`;
  return `${control}${error ? `<small class="settings-field-error" id="${id}-error">${escapeHtml(error)}</small>` : ""}`;
}

export function configurationStatus(scope: string, immediate = false): string {
  return `<div class="settings-capability ${immediate ? "is-available" : ""}"><span class="settings-status-dot" aria-hidden="true"></span><div><strong>${immediate ? "保存后生效" : "配置可保存 · 执行待接入"}</strong><p>${escapeHtml(scope)}</p></div></div>`;
}

export function configurationForm(group: ConfigurationGroup, view: ConfigurationView): string {
  const schema = configurationSchemas.find((entry) => entry.id === group)!;
  const draft = view.drafts[group];
  const values = draft?.values ?? view.data.groups[group];
  const errors = draft?.errors ?? {};
  const dirty = !!draft && JSON.stringify(draft.values) !== JSON.stringify(draft.base);
  return `${configurationStatus(schema.scope, schema.effect === "immediate")}<form class="settings-config-form" data-config-form="${group}" novalidate>${schema.blocks.map((block) => `<section class="settings-block"><h2>${block.title}</h2><div class="settings-option-group">${block.fields.map((original) => {
    const field = original.key === "modelId" ? { ...original, options: [["", group === "coding" ? "沿用 Agent 默认" : "暂不指定"] as const, ...view.data.collections.models.map((record) => [record.id, String(record.values.name)] as const)] } : original;
    const attributes = `data-config-field="${field.key}" data-focus="configuration-${group}-${field.key}"`;
    return `<div class="${field.type === "textarea" ? "settings-wide-field" : ""}">${settingRow(field.label, field.hint, configurationControl(field, values, attributes, errors[field.key]))}</div>`;
  }).join("")}</div></section>`).join("")}<div class="settings-form-actions"><span role="status" data-config-dirty>${errors.form ? escapeHtml(errors.form) : dirty ? "有未保存的更改" : "当前配置已保存"}</span><button class="settings-small-button" type="button" data-config-action="cancel" data-config-group="${group}" data-focus="configuration-${group}-cancel">取消更改</button><button class="primary-button" type="submit" data-focus="configuration-${group}-save">保存设置</button></div></form>`;
}
