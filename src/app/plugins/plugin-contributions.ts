import type { PluginIconName } from "./plugin-manifest";
import type { PluginRecord } from "./plugin-records";
import type { PluginSettingField } from "./plugin-settings";
import type { PluginSettingsPageId, PluginSource, PluginViewId, SlotContribution, WorkPanelViewContribution } from "./slot-registry";

/**
 * A plugin command in the command palette, run by the host. `openUrl` may be
 * a template filled from the plugin's settings (`fields`) when it runs.
 */
export interface PluginCommandContribution extends SlotContribution {
  icon?: PluginIconName;
  action: { openView: PluginViewId } | { openUrl: string; fields: PluginSettingField[] } | { openSettings: PluginSettingsPageId };
  plugin: PluginSource;
}

/** A plugin's settings page under 设置 → 插件; `id` is also the page id. */
export interface PluginSettingsContribution extends SlotContribution {
  id: PluginSettingsPageId;
  icon?: PluginIconName;
  description?: string;
  fields: PluginSettingField[];
  plugin: PluginSource;
}

export interface PluginContributions {
  views: WorkPanelViewContribution[];
  commands: PluginCommandContribution[];
  settings: PluginSettingsContribution[];
}

/**
 * The entries enabled plugins add to the open slots, in the order the
 * plugins were added. Disabled plugins add nothing; a URL command whose
 * `link.open` permission was not granted is left out.
 */
export function pluginContributions(records: readonly PluginRecord[]): PluginContributions {
  const views: WorkPanelViewContribution[] = [];
  const commands: PluginCommandContribution[] = [];
  const settings: PluginSettingsContribution[] = [];
  for (const record of records) {
    if (!record.enabled) continue;
    const { manifest } = record;
    const fields = manifest.settings.flatMap((section) => section.fields);
    for (const view of manifest.views) {
      views.push({
        id: view.id, view: view.id as PluginViewId, label: view.title,
        ...(view.content.kind === "status" ? { status: view.content.text } : { frame: { entry: view.content.entry, folder: record.folder, granted: record.granted, fields } }),
        plugin: { pluginId: manifest.id, pluginName: manifest.name, ...(view.icon ? { icon: view.icon } : {}), requires: [...manifest.requires, ...view.requires] },
      });
    }
    for (const command of manifest.commands) {
      if ("openUrl" in command.action && !record.granted.includes("link.open")) continue;
      commands.push({
        id: command.id, label: command.title, ...(command.icon ? { icon: command.icon } : {}),
        action: "openView" in command.action ? { openView: command.action.openView as PluginViewId }
          : "openSettings" in command.action ? { openSettings: command.action.openSettings as PluginSettingsPageId }
          : { openUrl: command.action.openUrl, fields },
        plugin: { pluginId: manifest.id, pluginName: manifest.name, requires: [...manifest.requires, ...command.requires] },
      });
    }
    for (const section of manifest.settings) {
      settings.push({
        id: section.id as PluginSettingsPageId, label: section.title, ...(section.icon ? { icon: section.icon } : {}),
        ...(section.description ? { description: section.description } : {}), fields: section.fields,
        plugin: { pluginId: manifest.id, pluginName: manifest.name, requires: manifest.requires },
      });
    }
  }
  return { views, commands, settings };
}
