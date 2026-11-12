/**
 * Interface plugin settings (`settings.section`, docs/plugin-slots.md):
 * the fields a plugin declares for its settings page, the values the user
 * keeps for them on this device, and the `{settings.<key>}` placeholders a
 * plugin's URL command fills from those values. NekoPapa renders the page
 * with its own settings rows and runs no plugin code; the values are read
 * only by the host (today: URL commands). Secrets are refused: a plugin
 * cannot ask for passwords, tokens or keys here.
 *
 * Values live under `nekopapa.ui-plugin-settings.v1` as
 * `{ plugins: { <plugin id>: { <key>: value } } }`. A stored value that no
 * longer fits its field reads as the field's default; unreadable data is
 * copied to a backup key and every plugin starts from its defaults.
 */

export type PluginSettingValue = string | boolean | number;
export type PluginSettingValues = Record<string, PluginSettingValue>;

interface FieldBase { key: string; label: string; description?: string }
export type PluginSettingField =
  | FieldBase & { type: "boolean"; default: boolean }
  | FieldBase & { type: "string"; default: string; placeholder?: string; maxLength: number }
  | FieldBase & { type: "number"; default: number; min?: number; max?: number; step?: number }
  | FieldBase & { type: "select"; default: string; options: { value: string; label: string }[] };

export const PLUGIN_SETTINGS_KEY = "nekopapa.ui-plugin-settings.v1";
export const PLUGIN_SETTINGS_BACKUP_KEY = `${PLUGIN_SETTINGS_KEY}.corrupt`;
export const SETTING_LIMITS = { fields: 12, label: 40, description: 200, options: 20, value: 200, maxLength: 1000 };

const KEY = /^[a-z][a-zA-Z0-9]{0,39}$/;
const SECRET = /pass(word|wd)?|secret|token|api_?key|credential|private_?key/i;
const PLACEHOLDER = /\{settings\.([^{}]*)\}/g;
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : undefined;

/** Reads a settings section's `fields`; every problem goes to `fail`. */
export function readSettingFields(value: unknown, where: string, fail: (message: string) => void): PluginSettingField[] {
  if (!Array.isArray(value) || value.length === 0) { fail(`${where}.fields 必须是非空数组。`); return []; }
  if (value.length > SETTING_LIMITS.fields) fail(`${where}.fields 最多 ${SETTING_LIMITS.fields} 项。`);
  const fields: PluginSettingField[] = [];
  value.forEach((entry, index) => { const field = readField(entry, `${where}.fields[${index}]`, fail); if (field) fields.push(field); });
  return fields;
}

function readField(entry: unknown, where: string, fail: (message: string) => void): PluginSettingField | undefined {
  if (!isObject(entry)) { fail(`${where} 必须是对象。`); return undefined; }
  const key = typeof entry.key === "string" ? entry.key : "";
  const label = text(entry.label, SETTING_LIMITS.label);
  const description = entry.description === undefined ? undefined : text(entry.description, SETTING_LIMITS.description);
  let ok = true;
  const bad = (message: string) => { ok = false; fail(message); };
  if (!KEY.test(key)) bad(`${where}.key 以小写字母开头，只含字母和数字，最多 40 个字符。`);
  else if (SECRET.test(key) || (label && SECRET.test(label))) bad(`${where} 看起来要保存密码、令牌或密钥；插件设置不保存这类内容。`);
  if (!label) bad(`${where}.label 必填，最多 ${SETTING_LIMITS.label} 个字符。`);
  if (entry.description !== undefined && !description) bad(`${where}.description 最多 ${SETTING_LIMITS.description} 个字符。`);
  const base = { key, label: label ?? "", ...(description ? { description } : {}) };
  const given = entry.default;
  switch (entry.type) {
    case "boolean":
      if (given !== undefined && typeof given !== "boolean") bad(`${where}.default 必须是 true 或 false。`);
      return ok ? { ...base, type: "boolean", default: given === true } : undefined;
    case "string": {
      const maxLength = entry.maxLength === undefined ? SETTING_LIMITS.value : entry.maxLength;
      if (!Number.isInteger(maxLength) || (maxLength as number) < 1 || (maxLength as number) > SETTING_LIMITS.maxLength) bad(`${where}.maxLength 是 1 到 ${SETTING_LIMITS.maxLength} 的整数。`);
      if (given !== undefined && (typeof given !== "string" || given.length > Math.min(Number(maxLength) || 0, SETTING_LIMITS.value))) bad(`${where}.default 必须是不超过 maxLength 的文本。`);
      const placeholder = entry.placeholder === undefined ? undefined : text(entry.placeholder, SETTING_LIMITS.label);
      if (entry.placeholder !== undefined && !placeholder) bad(`${where}.placeholder 最多 ${SETTING_LIMITS.label} 个字符。`);
      return ok ? { ...base, type: "string", default: typeof given === "string" ? given : "", maxLength: maxLength as number, ...(placeholder ? { placeholder } : {}) } : undefined;
    }
    case "number": {
      const bounds = (["min", "max", "step"] as const).filter((name) => entry[name] !== undefined);
      for (const name of bounds) if (typeof entry[name] !== "number" || !Number.isFinite(entry[name])) bad(`${where}.${name} 必须是数字。`);
      const min = entry.min as number | undefined;
      const max = entry.max as number | undefined;
      const step = entry.step as number | undefined;
      if (ok && min !== undefined && max !== undefined && min > max) bad(`${where}.min 不能大于 max。`);
      if (ok && step !== undefined && step <= 0) bad(`${where}.step 必须大于 0。`);
      const initial = given === undefined ? (min ?? 0) : given;
      if (typeof initial !== "number" || !Number.isFinite(initial) || (min !== undefined && initial < min) || (max !== undefined && initial > max)) bad(`${where}.default 必须是 min 与 max 之间的数字。`);
      return ok ? { ...base, type: "number", default: initial as number, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), ...(step !== undefined ? { step } : {}) } : undefined;
    }
    case "select": {
      const options = Array.isArray(entry.options) ? entry.options : [];
      const read = options.map((option) => isObject(option) && text(option.value, 60) && text(option.label, SETTING_LIMITS.label)
        ? { value: text(option.value, 60)!, label: text(option.label, SETTING_LIMITS.label)! } : undefined);
      if (options.length < 2 || options.length > SETTING_LIMITS.options || read.some((option) => !option)) bad(`${where}.options 需要 2 到 ${SETTING_LIMITS.options} 个 { value, label }。`);
      else if (new Set(read.map((option) => option!.value)).size !== read.length) bad(`${where}.options 的 value 重复了。`);
      if (given !== undefined && !read.some((option) => option?.value === given)) bad(`${where}.default 必须是 options 中的一个 value。`);
      return ok ? { ...base, type: "select", default: typeof given === "string" ? given : read[0]!.value, options: read as { value: string; label: string }[] } : undefined;
    }
    default:
      bad(`${where}.type 只能是 boolean、string、number 或 select。`);
      return undefined;
  }
}

/** Why `value` cannot be stored for `field`, or undefined when it fits. */
export function settingProblem(field: PluginSettingField, value: unknown): string | undefined {
  switch (field.type) {
    case "boolean": return typeof value === "boolean" ? undefined : "需要开或关。";
    case "string": return typeof value === "string" && value.length <= field.maxLength ? undefined : `最多 ${field.maxLength} 个字符。`;
    case "select": return field.options.some((option) => option.value === value) ? undefined : "不是可选的值。";
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return "需要数字。";
      if (field.min !== undefined && value < field.min) return `不能小于 ${field.min}。`;
      if (field.max !== undefined && value > field.max) return `不能大于 ${field.max}。`;
      return undefined;
  }
}

/** The value in effect: the stored one when it still fits the field, else the default. */
export const settingValue = (field: PluginSettingField, stored: PluginSettingValues | undefined): PluginSettingValue => {
  const value = stored && Object.prototype.hasOwnProperty.call(stored, field.key) ? stored[field.key] : undefined;
  return value !== undefined && !settingProblem(field, value) ? value : field.default;
};

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export type PluginSettingsStore = Record<string, PluginSettingValues>;
export type PluginSettingsRead = { values: PluginSettingsStore; status: "ok" | "empty" | "corrupt" | "unavailable" };

export function readPluginSettings(storage: Storage | undefined): PluginSettingsRead {
  let raw: string | null;
  try {
    if (!storage) return { values: {}, status: "unavailable" };
    raw = storage.getItem(PLUGIN_SETTINGS_KEY);
  } catch {
    return { values: {}, status: "unavailable" };
  }
  if (raw === null) return { values: {}, status: "empty" };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
  const plugins = isObject(parsed) && isObject(parsed.plugins) ? parsed.plugins : undefined;
  const valid = plugins && Object.values(plugins).every((values) => isObject(values)
    && Object.values(values).every((value) => ["string", "boolean", "number"].includes(typeof value)));
  if (!valid) {
    try { storage.setItem(PLUGIN_SETTINGS_BACKUP_KEY, raw); } catch { /* defaults still apply */ }
    return { values: {}, status: "corrupt" };
  }
  const values: PluginSettingsStore = Object.create(null);
  for (const [id, entry] of Object.entries(plugins!)) values[id] = Object.assign(Object.create(null), entry) as PluginSettingValues;
  return { values, status: "ok" };
}

/** Returns false when the values could not be saved (the change holds until reload). */
export function writePluginSettings(storage: Storage | undefined, values: PluginSettingsStore): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PLUGIN_SETTINGS_KEY, JSON.stringify({ plugins: values }));
    return true;
  } catch {
    return false;
  }
}

/** The setting keys a URL template reads, in order of appearance. */
export const templateKeys = (template: string) => [...template.matchAll(PLACEHOLDER)].map((match) => match[1]);

/**
 * Checks an `openUrl` that uses `{settings.<key>}`: it must be https with
 * the scheme and host written out, so a setting can fill only the path,
 * query or fragment and never send the page to another site.
 */
export function urlTemplateProblem(template: string): string | undefined {
  const stripped = template.replace(PLACEHOLDER, "x");
  if (/[{}]/.test(stripped)) return "占位符只能写成 {settings.<key>}。";
  if (templateKeys(template).some((key) => !KEY.test(key))) return "占位符里的 key 写法不对。";
  let url: URL;
  try { url = new URL(stripped); } catch { return "只接受 https 网址。"; }
  if (url.protocol !== "https:") return "只接受 https 网址。";
  const origin = /^https:\/\/[^/?#]*/i.exec(template)?.[0] ?? "";
  if (origin.includes("{")) return "网址的主机部分不能使用设置值，只能放在路径、查询或片段里。";
  return undefined;
}

/** `missing` is the label of the field to fill in, `key` its key. */
export type FilledUrl = { url: string } | { missing: string; key: string };

/**
 * Fills a URL template with the plugin's values. Each value is percent-
 * encoded (keeping "/" so a value can be a path like owner/repo); an empty
 * value names the field to fill in, and a result that left the template's
 * site is refused.
 */
export function fillUrlTemplate(template: string, fields: readonly PluginSettingField[], stored: PluginSettingValues | undefined): FilledUrl {
  for (const key of templateKeys(template)) {
    const field = fields.find((candidate) => candidate.key === key);
    if (!field || String(settingValue(field, stored)).trim() === "") return { missing: field?.label ?? key, key };
  }
  const filled = template.replace(PLACEHOLDER, (_, key: string) => {
    const field = fields.find((candidate) => candidate.key === key)!;
    return encodeURIComponent(String(settingValue(field, stored)).trim()).replace(/%2F/gi, "/");
  });
  const url = new URL(filled);
  if (url.origin !== new URL(template.replace(PLACEHOLDER, "x")).origin) {
    const key = templateKeys(template)[0];
    return { missing: fields.find((field) => field.key === key)?.label ?? key, key };
  }
  return { url: url.href };
}
