import { useMemo, useSyncExternalStore } from "react";
import { toast } from "@/components/base/toast/toast";
import { checkPluginManifest, type PluginManifest } from "@/app/plugins/plugin-manifest";
import { pluginContributions, type PluginContributions } from "@/app/plugins/plugin-contributions";
import { readPluginFolder } from "@/app/plugins/plugin-host";
import { WORK_PANEL_VIEWS, type WorkPanelViewContribution } from "@/app/plugins/slot-registry";
import {
  addPlugin, readPluginRecords, refreshPlugin, removePlugin, setPluginEnabled, writePluginRecords,
  type ManifestReading, type PluginRecord,
} from "@/app/plugins/plugin-records";
import { pluginSettingsActions } from "./use-plugin-settings";

/*
 * One shared copy of the interface plugins for the window, so the plugin
 * page, the work panel and the command palette change together. Read once
 * from local storage; then each enabled plugin's folder is read again, and
 * a plugin whose manifest is gone, broken or asks for new permissions is
 * turned off with a notice. Every change is applied at once and saved.
 */

interface State { records: PluginRecord[]; contributions: PluginContributions; refreshing: boolean }

const storage = () => { try { return globalThis.localStorage; } catch { return undefined; } };
let state: State | undefined;
const listeners = new Set<() => void>();

function set(records: PluginRecord[], refreshing = state?.refreshing ?? false) {
  state = { records, contributions: pluginContributions(records), refreshing };
  listeners.forEach((listener) => listener());
}

function commit(records: PluginRecord[]) {
  set(records);
  if (!writePluginRecords(storage(), records)) toast.error("界面插件列表没有保存", { description: "这次改动暂时有效，重新打开后恢复为上次保存的列表。" });
}

async function reading(folder: string): Promise<ManifestReading> {
  try { return { check: checkPluginManifest((await readPluginFolder(folder)).text) }; } catch (error) {
    return { error: error instanceof Error ? error.message : "读取失败。" };
  }
}

/** Reads every plugin's folder again (on start, and from the plugin page); each result applies to the list as it is then. */
export async function refreshPlugins() {
  if (current().refreshing) return;
  const targets = current().records.map(({ id, folder }) => ({ id, folder }));
  set(current().records, true);
  try {
    for (const { id, folder } of targets) {
      const result = await reading(folder);
      const before = current().records.find((record) => record.id === id);
      if (!before) continue;
      const records = refreshPlugin(current().records, id, result);
      const after = records.find((record) => record.id === id)!;
      if (JSON.stringify(after) === JSON.stringify(before)) continue;
      commit(records);
      if (before.enabled && !after.enabled) toast.error(`已停用插件“${after.manifest.name}”`, { description: after.problem });
    }
  } finally {
    set(current().records, false);
  }
}

function current(): State {
  if (!state) {
    const read = readPluginRecords(storage());
    set(read.records);
    if (read.status === "corrupt") queueMicrotask(() => toast.error("界面插件记录已损坏", { description: "已按没有插件的状态打开，原记录另存了一份备份。" }));
    if (read.records.length > 0) queueMicrotask(() => void refreshPlugins());
  }
  return state!;
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export const pluginActions = {
  add: (folder: string, manifest: PluginManifest) => commit(addPlugin(current().records, folder, manifest)),
  /** Forgets the plugin and its setting values; its folder is untouched. */
  remove: (id: string) => { commit(removePlugin(current().records, id)); pluginSettingsActions.forget(id); },
  setEnabled: (id: string, enabled: boolean) => commit(setPluginEnabled(current().records, id, enabled)),
};

export function useUiPlugins(): State {
  return useSyncExternalStore(subscribe, current, current);
}

/** The entries enabled plugins add to the work panel, command palette and settings. */
export const usePluginContributions = () => useUiPlugins().contributions;

/** The work panel's views: the built-in ones, then those of enabled interface plugins. */
export function useWorkPanelViews(): WorkPanelViewContribution[] {
  const plugins = usePluginContributions().views;
  return useMemo(() => [...WORK_PANEL_VIEWS, ...plugins], [plugins]);
}
