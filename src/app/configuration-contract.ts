import { personalConfiguration } from "./configuration-personal";
import { integrationConfiguration, collectionSchemas } from "./configuration-integrations";
import { codingConfiguration } from "./configuration-coding";
import { configurationCollections } from "./configuration-types";
import type { ConfigurationData, ConfigurationValues, ConfigurationField, ConfigurationRecord, ValidationResult } from "./configuration-types";

export const configurationSchemas = [...personalConfiguration, ...integrationConfiguration, ...codingConfiguration];
export { collectionSchemas };

export function configurationDefaults(): ConfigurationData {
  return {
    version: 1,
    groups: Object.fromEntries(configurationSchemas.map((schema) => [schema.id, fieldDefaults(schema.blocks.flatMap((block) => block.fields))])) as ConfigurationData["groups"],
    collections: { models: [], extensions: [], connections: [], hooks: [] },
  };
}

export function fieldDefaults(fields: readonly ConfigurationField[]): ConfigurationValues {
  return Object.fromEntries(fields.map((field) => [field.key, field.initial]));
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function validateFields(fields: readonly ConfigurationField[], input: unknown, complete = false): ValidationResult<ConfigurationValues> {
  if (!object(input)) return { ok: false, errors: { form: "配置必须是一个对象。" } };
  const errors: Record<string, string> = {};
  const values = fieldDefaults(fields);
  for (const key of Object.keys(input)) if (!fields.some((field) => field.key === key)) errors[key] = "含有不支持的字段。";
  for (const field of fields) {
    const raw = input[field.key];
    if (raw === undefined && !complete) continue;
    if (field.type === "boolean") {
      if (typeof raw !== "boolean") errors[field.key] = "请选择开启或关闭。";
      else values[field.key] = raw;
      continue;
    }
    if (field.type === "number") {
      const number = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
      if (!Number.isFinite(number) || number < field.min! || number > field.max! || (field.step === 1 && !Number.isInteger(number))) errors[field.key] = `请输入 ${field.min}–${field.max} 之间${field.step === 1 ? "的整数" : "的数值"}。`;
      else values[field.key] = number;
      continue;
    }
    if (typeof raw !== "string") { errors[field.key] = "请输入文本。"; continue; }
    const value = raw.trim();
    if (field.required && !value) errors[field.key] = "请填写此项。";
    else if (field.maxLength && value.length > field.maxLength) errors[field.key] = `最多 ${field.maxLength} 个字符。`;
    else if (field.type === "select" && !field.options?.some(([id]) => id === value)) errors[field.key] = "请选择有效选项。";
    else if (value && field.format === "url") {
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash) throw new Error();
      } catch { errors[field.key] = "填写 HTTP(S) 地址，不包含凭据、查询参数或片段。"; }
    } else if (value && field.format === "environment" && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) errors[field.key] = "请填写环境变量名，例如 MODEL_API_KEY；不填写密钥值。";
    else if (value && field.format === "branch" && (/\s|[~^:?*\[\\]|\.\.|@\{|\/\//.test(value) || value.startsWith("/") || value.startsWith("-") || value.endsWith(".") || value.includes(".lock"))) errors[field.key] = "请填写有效的 Git 分支前缀。";
    else if (value && field.format === "host" && (!/^[A-Za-z0-9._:[\]-]+$/.test(value) || value.includes(".."))) errors[field.key] = "请填写主机名或 IP 地址，不包含协议、空格或账号。";
    values[field.key] = value;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: values };
}

export function validateRecord(collection: keyof ConfigurationData["collections"], input: unknown): ValidationResult<ConfigurationValues> {
  const result = validateFields(collectionSchemas[collection].fields, input, true);
  if (!result.ok) return result;
  if (collection === "extensions") {
    const remote = result.value.transport === "http";
    if (result.value.kind === "skill" && remote) return { ok: false, errors: { transport: "技能使用本地目录。" } };
    if (remote && !result.value.endpoint) return { ok: false, errors: { endpoint: "HTTP 服务需要填写地址。" } };
    if (!remote && !result.value.command) return { ok: false, errors: { command: "本地配置需要命令或目录。" } };
    // Keep one transport path so a stale command cannot be accidentally executed.
    result.value[remote ? "command" : "endpoint"] = "";
  }
  return result;
}

export function validateConfiguration(input: unknown): ValidationResult<ConfigurationData> {
  if (!object(input) || input.version !== 1 || !object(input.groups) || !object(input.collections)) return { ok: false, errors: { file: "不是支持的 NekoPapa 设置数据（版本 1）。" } };
  if (Object.keys(input).some((key) => !["version", "groups", "collections"].includes(key))) return { ok: false, errors: { file: "设置数据含有未知内容。" } };
  const next = configurationDefaults();
  for (const key of Object.keys(input.groups)) {
    // Discard the superseded local Token preview; it never represents account cloud points.
    if (key === "usage" && object(input.groups.usage)
      && Object.keys(input.groups.usage).every((field) => ["period", "limit", "used", "resetDate"].includes(field))) continue;
    if (!configurationSchemas.some((schema) => schema.id === key)) return { ok: false, errors: { file: `不支持的设置分类：${key}` } };
  }
  for (const schema of configurationSchemas) {
    if (input.groups[schema.id] === undefined) continue;
    let fields = schema.blocks.flatMap((block) => block.fields);
    if (schema.id === "agent" || schema.id === "coding") fields = fields.map((field) => field.key === "modelId" ? { ...field, type: "text" as const, maxLength: 100 } : field);
    const result = validateFields(fields, input.groups[schema.id]);
    if (!result.ok) return { ok: false, errors: { file: `${schema.id}：${Object.values(result.errors)[0]}` } };
    next.groups[schema.id] = result.value;
    if (schema.id === "agent" && result.value.modelId && object(input.groups.agent)
      && input.groups.agent.modelSource === undefined) next.groups.agent.modelSource = "custom";
  }
  for (const key of Object.keys(input.collections)) if (!configurationCollections.includes(key as keyof ConfigurationData["collections"])) return { ok: false, errors: { file: `不支持的配置集合：${key}` } };
  const ids = new Set<string>();
  for (const collection of configurationCollections) {
    const records = input.collections[collection] ?? [];
    if (!Array.isArray(records) || records.length > 100) return { ok: false, errors: { file: "每类最多保存 100 份配置。" } };
    for (const record of records) {
      if (!object(record) || Object.keys(record).some((key) => !["id", "values"].includes(key)) || typeof record.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(record.id) || ids.has(record.id)) return { ok: false, errors: { file: "配置 ID 缺失、重复或无效。" } };
      const result = validateRecord(collection, record.values);
      if (!result.ok) return { ok: false, errors: { file: `${collection}：${Object.values(result.errors)[0]}` } };
      ids.add(record.id);
      next.collections[collection].push({ id: record.id, values: result.value } as ConfigurationRecord);
    }
  }
  for (const group of ["agent", "coding"] as const) {
    const id = next.groups[group].modelId;
    if (id && !next.collections.models.some((record) => record.id === id)) return { ok: false, errors: { file: "默认模型引用不存在的连接。" } };
  }
  return { ok: true, value: next };
}

export function exportConfiguration(data: ConfigurationData): string {
  return JSON.stringify({ format: "NekoPapa settings", version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

export function parseConfigurationBackup(source: string): ValidationResult<ConfigurationData> {
  if (new TextEncoder().encode(source).length > 1024 * 1024) return { ok: false, errors: { file: "设置备份不能超过 1 MiB。" } };
  try {
    const input: unknown = JSON.parse(source);
    if (!object(input) || input.format !== "NekoPapa settings" || input.version !== 1 || Object.keys(input).some((key) => !["format", "version", "exportedAt", "data"].includes(key))) throw new Error();
    return validateConfiguration(input.data);
  } catch { return { ok: false, errors: { file: "无法读取，请选择 NekoPapa 导出的设置 JSON 文件。" } }; }
}
