import { icon } from "./icons";
import { escapeHtml } from "./view-shared";
import { collectionSchemas } from "./configuration-contract";
import type { ConfigurationCollection, ConfigurationView, ConfigurationRecord } from "./configuration-types";
import { configurationStatus } from "./settings-form-view";

function recordDescription(collection: ConfigurationCollection, record: ConfigurationRecord): string {
  const values = record.values;
  if (collection === "models") return `${values.model} · ${values.endpoint}`;
  if (collection === "extensions") return `${values.kind === "skill" ? "技能目录" : values.kind === "connector" ? "连接器" : "MCP"} · ${values.transport === "http" ? values.endpoint : values.command}`;
  if (collection === "connections") return `${values.username}@${values.host}:${values.port}`;
  return `${values.event} · ${values.command} · ${values.timeout} 秒`;
}

export function collectionRecords(collection: ConfigurationCollection, view: ConfigurationView): string {
  const query = (view.queries[collection] ?? "").trim().toLocaleLowerCase();
  const records = view.data.collections[collection].filter((record) => [record.values.name, recordDescription(collection, record)].join(" ").toLocaleLowerCase().includes(query));
  const schema = collectionSchemas[collection];
  if (!records.length) return `<div class="settings-list-empty" role="status">${icon(collection === "hooks" ? "workflow" : "link")}<strong>${query ? "没有匹配的配置" : `还没有${schema.singular}`}</strong><p>${query ? "试试其他名称或清除搜索。" : "添加配置后会保存在当前设备，可以随设置备份导出。"}</p>${query ? `<button class="settings-small-button" data-config-action="clear-filter" data-config-collection="${collection}" type="button">清除搜索</button>` : `<button class="settings-small-button" data-config-action="add" data-config-collection="${collection}" type="button">添加${schema.singular}</button>`}</div>`;
  return records.map((record) => `<article class="settings-record"><span class="settings-record-icon">${icon(collection === "hooks" ? "workflow" : collection === "extensions" ? "tools" : "link")}</span><div class="settings-record-copy"><h3>${escapeHtml(String(record.values.name))}</h3><p>${escapeHtml(recordDescription(collection, record))}</p><small>${collection === "models" && record.values.environment ? `凭据引用：${escapeHtml(String(record.values.environment))} · ` : ""}已保存配置 · 未连接</small></div><div class="settings-record-actions"><button class="settings-small-button" type="button" data-config-action="edit" data-config-collection="${collection}" data-config-id="${record.id}" data-focus="configuration-edit-${record.id}" aria-label="编辑${escapeHtml(String(record.values.name))}">编辑</button><button class="icon-button" type="button" data-config-action="remove" data-config-collection="${collection}" data-config-id="${record.id}" data-focus="configuration-remove-${record.id}" aria-label="删除${escapeHtml(String(record.values.name))}">${icon("trash")}</button></div></article>`).join("");
}

export function collectionSettings(collection: ConfigurationCollection, view: ConfigurationView): string {
  const schema = collectionSchemas[collection];
  const undo = view.removedRecord?.collection === collection ? `<div class="settings-undo">已删除「${escapeHtml(view.removedRecord.name)}」<button class="settings-small-button" type="button" data-config-action="undo-remove">撤销删除</button></div>` : "";
  return `${configurationStatus(schema.description)}${undo}<div class="settings-list-toolbar"><h2>${schema.title}<span>${view.data.collections[collection].length}</span></h2><button class="primary-button" type="button" data-config-action="add" data-config-collection="${collection}" data-focus="configuration-add-${collection}">${icon("plus")}添加${schema.singular}</button></div><label class="settings-page-search">${icon("search")}<input type="search" placeholder="搜索${schema.title}" aria-label="搜索${schema.title}" value="${escapeHtml(view.queries[collection] ?? "")}" data-config-filter="${collection}" data-focus="configuration-filter-${collection}" /></label><div class="settings-records" data-config-records="${collection}">${collectionRecords(collection, view)}</div>${collection === "models" ? '<p class="settings-footnote">在「Agent 配置」中将模型来源设为自定义 API，并选择已保存的配置。凭据只保存环境变量引用；实际调用和安全凭据存储将在运行服务接入后提供。</p>' : ""}`;
}
