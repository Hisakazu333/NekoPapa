/**
 * Extension slots (docs/plugin-slots.md, stage 1): the places in the
 * workbench whose entries come from one registry instead of a hard-coded
 * list. Stage 1 registers only NekoPapa's own entries under the core plugin;
 * no third-party code is loaded. Each contribution has a stable id
 * `<plugin id>/<local id>`, which is also the key of the user's layout
 * preferences, so a later plugin entry is arranged the same way.
 */

import type { PluginIconName, PluginRequirement } from "./plugin-manifest";

export type SlotId = "workPanel.view" | "command.palette";

/** A plugin's work panel view id: its contribution id `<plugin id>/<local id>`. */
export type PluginViewId = `${string}/${string}`;
export const isPluginViewId = (view: string): view is PluginViewId => view.includes("/");
/** A plugin settings page id, also its contribution id; built-in settings pages have no "/". */
export type PluginSettingsPageId = `${string}/${string}`;
export const isPluginSettingsPage = (page: string): page is PluginSettingsPageId => page.includes("/");

export const CORE_PLUGIN = "nekopapa.core";

export interface SlotContribution {
  /** `<plugin id>/<local id>`. */
  id: string;
  label: string;
  /** Always shown: hiding it is refused. */
  required?: boolean;
  /** Why it cannot be hidden, shown beside it in the layout settings. */
  requiredReason?: string;
}

/** Where a plugin's entry comes from and what it shows; NekoPapa renders it. */
export interface PluginSource {
  pluginId: string;
  pluginName: string;
  icon?: PluginIconName;
  requires: PluginRequirement[];
}

/**
 * A work panel view: `view` is the WorkPanelView id the panel already uses,
 * or a plugin view's contribution id (then `plugin` and `status` are set).
 */
export interface WorkPanelViewContribution extends SlotContribution {
  view: "history" | "code" | "study" | "outline" | PluginViewId;
  plugin?: PluginSource;
  /** A plugin view's declared status text. */
  status?: string;
}

/** A command palette entry that opens a work panel view (hidden with that view). */
export interface ViewCommandContribution extends SlotContribution {
  opens: "history" | "code" | "study";
}

const PLUGIN_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const LOCAL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isContributionId(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 200) return false;
  const slash = value.indexOf("/");
  return slash > 0 && PLUGIN_ID.test(value.slice(0, slash)) && LOCAL_ID.test(value.slice(slash + 1));
}

export function contributionId(pluginId: string, localId: string): string {
  const id = `${pluginId}/${localId}`;
  if (!isContributionId(id)) throw new Error(`Invalid contribution id: ${id}`);
  return id;
}

const core = (localId: string) => contributionId(CORE_PLUGIN, localId);

/** The work panel's tabs, in their default order. */
export const WORK_PANEL_VIEWS: readonly WorkPanelViewContribution[] = [
  { id: core("history"), view: "history", label: "历史", required: true, requiredReason: "其他视图被隐藏或失效时回到这里。" },
  { id: core("code"), view: "code", label: "代码" },
  { id: core("study"), view: "study", label: "资料" },
  { id: core("tools"), view: "outline", label: "工具", required: true, requiredReason: "终端、更改和文件有快捷键直达，打开时需要这个标签。" },
];

/** Command palette entries that open a view; each is hidden with its view. */
export const VIEW_COMMANDS: readonly ViewCommandContribution[] = [
  { id: core("open-history"), opens: "history", label: "打开历史" },
  { id: core("open-code"), opens: "code", label: "打开代码与环境" },
  { id: core("open-study"), opens: "study", label: "打开资料" },
];

export const SLOT_LABELS: Record<SlotId, string> = {
  "workPanel.view": "工作面板标签",
  "command.palette": "命令面板",
};
