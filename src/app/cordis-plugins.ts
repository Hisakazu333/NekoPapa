import type { ConfigurationField as Field, ConfigurationRecord, ConfigurationValues, ValidationResult } from "./configuration-types";

/**
 * 设置 → 开发 → Cordis 插件. A DeepSeek Harness (dsh) plugin is a TS / JS
 * module (`export function apply(ctx)`) that Cordis loads from a config entry:
 * a module path or npm package as `name`, an optional instance `id`, its
 * `config`, and whether it is `disabled`. NekoPapa only keeps these entries on
 * this computer and can show them as a Cordis patch; nothing is installed,
 * imported or run until the Coding 执行层 exists.
 */
export const cordisPluginFields: readonly Field[] = [
  { key: "name", label: "名称", hint: "用于识别这份插件配置。", type: "text", control: "input", initial: "", maxLength: 72, required: true },
  { key: "source", label: "来源", hint: "", type: "select", control: "segmented", initial: "local", options: [["local", "本地模块"], ["npm", "npm 包"]],
    optionHints: { local: "填写插件入口文件或目录的绝对路径。", npm: "填写 npm 包名；不会自动安装。" } },
  { key: "module", label: "模块", hint: "Cordis 配置里的 name。保存时不会读取、安装或执行。", type: "text", control: "input", initial: "", maxLength: 500, required: true, placeholder: "/Users/你/plugins/my-plugin.ts" },
  { key: "instanceId", label: "实例 ID", hint: "Cordis 配置里的 id，可留空；只能包含字母、数字、- 和 _。", type: "text", control: "input", initial: "", maxLength: 64, placeholder: "my-plugin" },
  { key: "enabled", label: "执行层接入后加载", hint: "关闭时补丁中写为 disabled: true。", type: "boolean", control: "switch", initial: true },
  { key: "config", label: "插件配置（YAML）", hint: "传给 apply(ctx, config) 的配置，原样保存，不在这里解析或校验。", type: "textarea", control: "textarea", initial: "", maxLength: 4000 },
];

const npmName = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const absolutePath = /^(\/|~\/|[A-Za-z]:[\\/])/;

/** Rules beyond the field formats; runs after the shared field validation. */
export function validateCordisPlugin(result: ValidationResult<ConfigurationValues>): ValidationResult<ConfigurationValues> {
  if (!result.ok) return result;
  const { source, module, instanceId } = result.value;
  const modulePath = String(module);
  if (source === "npm" && !npmName.test(modulePath)) return { ok: false, errors: { module: "请填写 npm 包名，例如 @scope/dsh-plugin-name。" } };
  if (source === "local" && (!absolutePath.test(modulePath) || /[\r\n]/.test(modulePath))) return { ok: false, errors: { module: "请填写以 / 或 ~/ 开头的绝对路径。" } };
  if (instanceId && !/^[A-Za-z0-9_-]+$/.test(String(instanceId))) return { ok: false, errors: { instanceId: "只能包含字母、数字、- 和 _。" } };
  return result;
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Instance IDs used by more than one entry; Cordis needs them to be unique. */
export function duplicateInstanceIds(records: readonly ConfigurationRecord[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const record of records) {
    const id = String(record.values.instanceId ?? "");
    if (!id) continue;
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated];
}

/**
 * The saved entries as one Cordis `insert` patch, in the shape of the dsh
 * README example (`- insert: - id / name`) with Cordis loader's `disabled`
 * and `config` keys. Config text is indented as written, not re-serialised.
 */
export function cordisPatch(records: readonly ConfigurationRecord[]): string {
  if (!records.length) return "";
  const lines = ["- insert:"];
  for (const record of records) {
    const id = String(record.values.instanceId ?? "");
    const entry = [...(id ? [`id: ${quote(id)}`] : []), `name: ${quote(String(record.values.module ?? ""))}`];
    if (record.values.enabled === false) entry.push("disabled: true");
    const config = String(record.values.config ?? "").replace(/\s+$/, "");
    if (config) entry.push("config:", ...config.split(/\r?\n/).map((line) => line ? `  ${line}` : ""));
    entry.forEach((line, index) => lines.push(line ? `${index === 0 ? "    - " : "      "}${line}` : ""));
  }
  return `${lines.join("\n")}\n`;
}
