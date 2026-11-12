import { CORE_PLUGIN, contributionId } from "./slot-registry";
import { readSettingFields, templateKeys, urlTemplateProblem, type PluginSettingField } from "./plugin-settings";
import { isFrameEntry } from "./plugin-frame-paths";

/**
 * Interface plugin manifests (`nekopapa-plugin.json`, docs/plugin-slots.md).
 * A plugin is a folder whose manifest declares what it adds to the
 * workbench's extension slots; NekoPapa renders every entry itself with its
 * own components and runs no code from the folder. Validation is strict:
 * an error rejects the manifest with every reason listed; slots and
 * permissions that exist but are not open yet are reported as warnings and
 * are not applied, never silently ignored.
 */

export const MANIFEST_FILE = "nekopapa-plugin.json";
export const APP_VERSION = "0.1.0";

/** Conditions the host checks itself; a plugin cannot report them as met. */
export type PluginRequirement = "desktop" | "runtime.coding" | "backend.nekobuddy";
export const PLUGIN_REQUIREMENTS: Record<PluginRequirement, string> = {
  desktop: "需要 NekoPapa 桌面应用",
  "runtime.coding": "需要 Coding 执行层",
  "backend.nekobuddy": "需要 NekoBuddy 后端",
};

/** Permissions open now, later stages (shown, not granted) and refused outright. */
export const PLUGIN_PERMISSIONS: Record<string, { label: string; open: boolean }> = {
  "link.open": { label: "在系统浏览器中打开网址", open: true },
  "chat.read": { label: "读取当前对话的消息文本", open: false },
  "chat.draft": { label: "向当前草稿追加内容", open: false },
  "project.read": { label: "只读当前项目的文件与 Git 状态", open: false },
};
const REFUSED_PERMISSIONS = new Set(["network", "shell", "credentials"]);

/** Icon names a plugin may use; the host maps each to its own icon set. */
export const PLUGIN_ICON_NAMES = [
  "puzzle", "plug", "notebook-pen", "book-open", "library", "code", "file-code", "terminal", "git-branch",
  "globe", "link", "history", "layers", "list-checks", "lightbulb", "wrench", "bot", "database",
  "chart-column", "messages-square", "palette", "sparkle", "compass", "map", "sticky-note",
] as const;
export type PluginIconName = (typeof PLUGIN_ICON_NAMES)[number];

/** Slots this version applies, and the ones a later stage opens. */
const OPEN_SLOTS = ["workPanel.view", "command.palette", "settings.section"] as const;
const LATER_SLOTS: Record<string, string> = {
  "sidebar.destination": "侧栏入口",
  "titlebar.action": "标题栏按钮",
  "composer.add": "输入框“+”菜单",
  "conversation.view": "会话视图（需要 Agent 运行时）",
  "composer.model": "模型来源（需要 Agent 运行时）",
};

export interface PluginStatusContent { kind: "status"; text: string }
/** A page from the plugin folder, shown in a sandboxed frame (docs/plugin-slots.md, stage 3). */
export interface PluginFrameContent { kind: "frame"; entry: string }
export interface PluginView {
  /** `<plugin id>/<local id>`, also the work panel view id. */
  id: string;
  localId: string;
  title: string;
  icon?: PluginIconName;
  content: PluginStatusContent | PluginFrameContent;
  requires: PluginRequirement[];
}
/** A settings page in 设置 → 插件; its values stay on this device. */
export interface PluginSettingsSection {
  /** `<plugin id>/<local id>`, also the settings page id. */
  id: string;
  localId: string;
  title: string;
  icon?: PluginIconName;
  description?: string;
  fields: PluginSettingField[];
}
/**
 * `openUrl` may read the plugin's settings through `{settings.<key>}` in the
 * path, query or fragment; `openView` and `openSettings` hold full ids.
 */
export type PluginAction = { openView: string } | { openUrl: string } | { openSettings: string };
export interface PluginCommand {
  id: string;
  localId: string;
  title: string;
  icon?: PluginIconName;
  action: PluginAction;
  requires: PluginRequirement[];
}

export interface PluginManifest {
  manifestVersion: 1;
  id: string;
  name: string;
  version: string;
  description?: string;
  engine: string;
  /** Declared permissions, granted only when open and confirmed by the user. */
  permissions: string[];
  requires: PluginRequirement[];
  views: PluginView[];
  commands: PluginCommand[];
  settings: PluginSettingsSection[];
  /** The Cordis runtime plugin this one belongs to, shown for reference only. */
  cordis?: { module: string; instanceId?: string };
}

export type ManifestCheck =
  | { ok: true; manifest: PluginManifest; warnings: string[] }
  | { ok: false; errors: string[] };

const PLUGIN_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const LOCAL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const RANGE = /^>=\s*(\d+\.\d+\.\d+)$/;
const LIMITS = { views: 3, commands: 10, settings: 2, title: 16, commandTitle: 40, name: 40, description: 200, text: 400 };

type Json = Record<string, unknown>;
const own = (table: object, key: string) => Object.prototype.hasOwnProperty.call(table, key);
const isObject = (value: unknown): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : undefined;
const version = (value: string) => SEMVER.exec(value)?.slice(1, 4).map(Number);

/** Whether this app's version is inside `range` (only `>=x.y.z` is supported). */
export function engineAccepts(range: string, app = APP_VERSION): boolean | undefined {
  const minimum = RANGE.exec(range.trim())?.[1];
  if (!minimum) return undefined;
  const [want, have] = [version(minimum)!, version(app)!];
  for (let index = 0; index < 3; index += 1) if (have[index] !== want[index]) return have[index] > want[index];
  return true;
}

export function checkPluginManifest(source: string): ManifestCheck {
  let value: unknown;
  try { value = JSON.parse(source); } catch { return { ok: false, errors: [`${MANIFEST_FILE} 不是有效的 JSON。`] }; }
  if (!isObject(value)) return { ok: false, errors: [`${MANIFEST_FILE} 的顶层必须是对象。`] };
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (message: string) => { errors.push(message); };

  if (value.manifestVersion !== 1) fail(value.manifestVersion === undefined ? "缺少 manifestVersion。" : `不支持的 manifestVersion：${String(value.manifestVersion)}（当前只支持 1）。`);
  const id = typeof value.id === "string" ? value.id : "";
  if (!PLUGIN_ID.test(id) || id.length > 100) fail("id 只能包含小写字母、数字、“-”和“.”。");
  else if (id === CORE_PLUGIN || id.startsWith("nekopapa.")) fail("“nekopapa.” 开头的 id 留给 NekoPapa 自带内容。");
  const name = text(value.name, LIMITS.name);
  if (!name) fail(`name 必填，最多 ${LIMITS.name} 个字符。`);
  const pluginVersion = typeof value.version === "string" && SEMVER.test(value.version) ? value.version : undefined;
  if (!pluginVersion) fail("version 需要是 semver 版本号，例如 0.1.0。");
  const description = value.description === undefined ? undefined : text(value.description, LIMITS.description);
  if (value.description !== undefined && !description) fail(`description 最多 ${LIMITS.description} 个字符。`);

  const engine = isObject(value.engines) && typeof value.engines.nekopapa === "string" ? value.engines.nekopapa : "";
  const accepts = engine ? engineAccepts(engine) : undefined;
  if (!engine) fail("缺少 engines.nekopapa（兼容的 NekoPapa 版本范围）。");
  else if (accepts === undefined) fail(`engines.nekopapa 只支持“>=x.y.z”写法，收到“${engine}”。`);
  else if (!accepts) fail(`这个插件需要 NekoPapa ${engine}，当前版本是 ${APP_VERSION}。`);

  const permissions = strings(value.permissions, "permissions", fail);
  for (const permission of permissions) {
    if (REFUSED_PERMISSIONS.has(permission)) fail(`不开放权限“${permission}”：网络、命令和密钥只由 Coding 执行层按权限规则提供。`);
    else if (!own(PLUGIN_PERMISSIONS, permission)) fail(`未知权限“${permission}”。`);
    else if (!PLUGIN_PERMISSIONS[permission].open) warnings.push(`权限“${permission}”（${PLUGIN_PERMISSIONS[permission].label}）暂未开放，不会授予。`);
  }
  const requires = requirements(value.requires, "requires", fail);

  const contributes = isObject(value.contributes) ? value.contributes : undefined;
  if (!contributes) fail("contributes 必填，且必须是对象。");
  const views: PluginView[] = [];
  const commands: PluginCommand[] = [];
  const settings: PluginSettingsSection[] = [];
  for (const [slot, list] of Object.entries(contributes ?? {})) {
    if (own(LATER_SLOTS, slot)) { warnings.push(`扩展位“${slot}”（${LATER_SLOTS[slot]}）暂不支持，这部分不会显示。`); continue; }
    if (!(OPEN_SLOTS as readonly string[]).includes(slot)) { fail(`未知扩展位“${slot}”。`); continue; }
    if (!Array.isArray(list)) { fail(`contributes["${slot}"] 必须是数组。`); continue; }
    const at = (index: number) => `contributes["${slot}"][${index}]`;
    if (slot === "workPanel.view") {
      if (list.length > LIMITS.views) fail(`每个插件最多 ${LIMITS.views} 个工作面板视图。`);
      list.forEach((entry, index) => { const view = readView(entry, at(index), id, fail); if (view) views.push(view); });
    } else if (slot === "settings.section") {
      if (list.length > LIMITS.settings) fail(`每个插件最多 ${LIMITS.settings} 个设置页。`);
      list.forEach((entry, index) => { const section = readSettingsSection(entry, at(index), id, fail); if (section) settings.push(section); });
    } else {
      if (list.length > LIMITS.commands) fail(`每个插件最多 ${LIMITS.commands} 条命令。`);
      list.forEach((entry, index) => { const command = readCommand(entry, at(index), id, permissions, fail); if (command) commands.push(command); });
    }
  }
  duplicates([...views, ...commands, ...settings].map((entry) => entry.localId), fail);
  const fields = settings.flatMap((section) => section.fields);
  for (const key of new Set(fields.map((field) => field.key))) {
    if (fields.filter((field) => field.key === key).length > 1) fail(`设置 key “${key}” 重复了（同一插件的设置页共用一组 key）。`);
  }
  for (const command of commands) resolveAction(command, id, views, settings, fields, fail);
  if (contributes && views.length + commands.length + settings.length === 0 && errors.length === 0) fail("没有当前可用的贡献：至少声明一个 workPanel.view、command.palette 或 settings.section 条目。");

  let cordis: PluginManifest["cordis"];
  if (value.runtime !== undefined) {
    const runtime = isObject(value.runtime) && isObject(value.runtime.cordis) ? value.runtime.cordis : undefined;
    const module = runtime ? text(runtime.module, 300) : undefined;
    if (!module) fail("runtime.cordis.module 必填（Cordis 插件的本地路径或 npm 包名）。");
    else cordis = { module, ...(text(runtime?.instanceId, 100) ? { instanceId: text(runtime?.instanceId, 100)! } : {}) };
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    warnings,
    manifest: {
      manifestVersion: 1, id, name: name!, version: pluginVersion!, ...(description ? { description } : {}), engine,
      permissions, requires, views, commands, settings, ...(cordis ? { cordis } : {}),
    },
  };
}

function strings(value: unknown, field: string, fail: (message: string) => void): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) { fail(`${field} 必须是字符串数组。`); return []; }
  return [...new Set(value as string[])];
}

function requirements(value: unknown, field: string, fail: (message: string) => void): PluginRequirement[] {
  const list = strings(value, field, fail);
  const unknown = list.filter((item) => !own(PLUGIN_REQUIREMENTS, item));
  if (unknown.length > 0) fail(`${field} 中有未知条件：${unknown.join("、")}（可用：${Object.keys(PLUGIN_REQUIREMENTS).join("、")}）。`);
  return list.filter((item): item is PluginRequirement => own(PLUGIN_REQUIREMENTS, item));
}

function icon(value: unknown, where: string, fail: (message: string) => void): PluginIconName | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string" && (PLUGIN_ICON_NAMES as readonly string[]).includes(value)) return value as PluginIconName;
  fail(`${where}.icon 不是可用的图标名（可用：${PLUGIN_ICON_NAMES.join("、")}）。`);
  return undefined;
}

function localId(entry: Json, where: string, pluginId: string, fail: (message: string) => void) {
  const local = typeof entry.id === "string" ? entry.id : "";
  if (!LOCAL_ID.test(local) || local.length > 60) { fail(`${where}.id 只能包含小写字母、数字和“-”。`); return undefined; }
  if (!PLUGIN_ID.test(pluginId)) return undefined;
  return { local, full: contributionId(pluginId, local) };
}

function readView(entry: unknown, where: string, pluginId: string, fail: (message: string) => void): PluginView | undefined {
  if (!isObject(entry)) { fail(`${where} 必须是对象。`); return undefined; }
  const ids = localId(entry, where, pluginId, fail);
  const title = text(entry.title, LIMITS.title);
  if (!title) fail(`${where}.title 必填，最多 ${LIMITS.title} 个字符。`);
  const content = isObject(entry.content) ? entry.content : undefined;
  let status: PluginView["content"] | undefined;
  if (!content) fail(`${where}.content 必填。`);
  else if (content.kind === "list") fail(`${where}.content.kind “list” 暂不支持；可用 “status” 或 “frame”。`);
  else if (content.kind === "frame") {
    const entry = typeof content.entry === "string" ? content.entry : "";
    if (!isFrameEntry(entry)) fail(`${where}.content.entry 必须是插件文件夹内的 .html 相对路径（只用字母、数字、“.”“_”“-”，不能以“.”开头，最多 12 层）。`);
    else status = { kind: "frame", entry };
  } else if (content.kind !== "status") fail(`${where}.content.kind 只能是 “status” 或 “frame”。`);
  else {
    const body = text(content.text, LIMITS.text);
    if (!body) fail(`${where}.content.text 必填，最多 ${LIMITS.text} 个字符。`);
    else status = { kind: "status", text: body };
  }
  const viewIcon = icon(entry.icon, where, fail);
  const requires = requirements(entry.requires, `${where}.requires`, fail);
  if (!ids || !title || !status) return undefined;
  return { id: ids.full, localId: ids.local, title, ...(viewIcon ? { icon: viewIcon } : {}), content: status, requires };
}

function readCommand(entry: unknown, where: string, pluginId: string, permissions: string[], fail: (message: string) => void): PluginCommand | undefined {
  if (!isObject(entry)) { fail(`${where} 必须是对象。`); return undefined; }
  const ids = localId(entry, where, pluginId, fail);
  const title = text(entry.title, LIMITS.commandTitle);
  if (!title) fail(`${where}.title 必填，最多 ${LIMITS.commandTitle} 个字符。`);
  const raw = isObject(entry.action) ? entry.action : undefined;
  const kinds = raw ? Object.keys(raw) : [];
  let action: PluginAction | undefined;
  if (!raw || kinds.length !== 1) fail(`${where}.action 必须恰好包含 openView、openUrl 或 openSettings 中的一项。`);
  else if (kinds[0] === "openView" && typeof raw.openView === "string") {
    const target = raw.openView.startsWith("workPanel.view/") ? raw.openView.slice("workPanel.view/".length) : raw.openView;
    action = { openView: target };
  } else if (kinds[0] === "openUrl" && typeof raw.openUrl === "string") {
    const template = raw.openUrl.includes("{");
    let url: URL | undefined;
    try { url = template ? undefined : new URL(raw.openUrl); } catch { /* reported below */ }
    const problem = template ? urlTemplateProblem(raw.openUrl) : !url || url.protocol !== "https:" ? "只接受 https 网址。" : undefined;
    if (problem) fail(`${where}.action.openUrl ${problem}`);
    else if (!permissions.includes("link.open")) fail(`${where} 打开网址需要声明权限 “link.open”。`);
    else action = { openUrl: template ? raw.openUrl : url!.href };
  } else if (kinds[0] === "openSettings" && typeof raw.openSettings === "string") {
    const target = raw.openSettings.startsWith("settings.section/") ? raw.openSettings.slice("settings.section/".length) : raw.openSettings;
    action = { openSettings: target };
  } else fail(`${where}.action 的写法不对。`);
  const commandIcon = icon(entry.icon, where, fail);
  const requires = requirements(entry.requires, `${where}.requires`, fail);
  if (!ids || !title || !action) return undefined;
  return { id: ids.full, localId: ids.local, title, ...(commandIcon ? { icon: commandIcon } : {}), action, requires };
}

function readSettingsSection(entry: unknown, where: string, pluginId: string, fail: (message: string) => void): PluginSettingsSection | undefined {
  if (!isObject(entry)) { fail(`${where} 必须是对象。`); return undefined; }
  const ids = localId(entry, where, pluginId, fail);
  const title = text(entry.title, LIMITS.title);
  if (!title) fail(`${where}.title 必填，最多 ${LIMITS.title} 个字符。`);
  const description = entry.description === undefined ? undefined : text(entry.description, LIMITS.description);
  if (entry.description !== undefined && !description) fail(`${where}.description 最多 ${LIMITS.description} 个字符。`);
  const sectionIcon = icon(entry.icon, where, fail);
  const fields = readSettingFields(entry.fields, where, fail);
  if (!ids || !title || fields.length === 0) return undefined;
  return { id: ids.full, localId: ids.local, title, ...(sectionIcon ? { icon: sectionIcon } : {}), ...(description ? { description } : {}), fields };
}

/** Points `openView` / `openSettings` at the declared entry's full id and checks the settings a URL reads. */
function resolveAction(command: PluginCommand, pluginId: string, views: PluginView[], settings: PluginSettingsSection[], fields: PluginSettingField[], fail: (message: string) => void) {
  const action = command.action;
  if ("openView" in action) {
    if (views.some((view) => view.localId === action.openView)) command.action = { openView: `${pluginId}/${action.openView}` };
    else fail(`命令“${command.localId}”打开的视图“${action.openView}”没有在 workPanel.view 中声明。`);
  } else if ("openSettings" in action) {
    if (settings.some((section) => section.localId === action.openSettings)) command.action = { openSettings: `${pluginId}/${action.openSettings}` };
    else fail(`命令“${command.localId}”打开的设置页“${action.openSettings}”没有在 settings.section 中声明。`);
  } else {
    for (const key of templateKeys(action.openUrl)) {
      const field = fields.find((candidate) => candidate.key === key);
      if (!field) fail(`命令“${command.localId}”的网址读取了没有声明的设置“${key}”。`);
      else if (field.type === "boolean") fail(`命令“${command.localId}”的网址不能读取开关设置“${key}”。`);
    }
  }
}

function duplicates(ids: string[], fail: (message: string) => void) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) fail(`贡献 id “${id}” 重复了。`);
    seen.add(id);
  }
}

/** Permissions the user can grant now (declared and open). */
export const grantablePermissions = (manifest: PluginManifest) =>
  manifest.permissions.filter((permission) => own(PLUGIN_PERMISSIONS, permission) && PLUGIN_PERMISSIONS[permission].open);
