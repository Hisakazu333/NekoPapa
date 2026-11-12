import { useSyncExternalStore } from "react";
import { toast } from "@/components/base/toast/toast";
import {
  readPluginSettings, settingProblem, writePluginSettings,
  type PluginSettingField, type PluginSettingValue, type PluginSettingsStore,
} from "@/app/plugins/plugin-settings";

/*
 * One shared copy of the interface plugins' setting values for the window,
 * so a plugin's settings page and the commands that read it change
 * together. Read once from local storage; each change is checked against
 * its field, applied at once and saved.
 */

const storage = () => { try { return globalThis.localStorage; } catch { return undefined; } };
let values: PluginSettingsStore | undefined;
const listeners = new Set<() => void>();

function current(): PluginSettingsStore {
  if (!values) {
    const read = readPluginSettings(storage());
    values = read.values;
    if (read.status === "corrupt") queueMicrotask(() => toast.error("界面插件的设置值已损坏", { description: "各插件按默认值打开，原数据另存了一份备份。" }));
  }
  return values;
}

function commit(next: PluginSettingsStore) {
  values = next;
  listeners.forEach((listener) => listener());
  if (!writePluginSettings(storage(), next)) toast.error("插件设置没有保存", { description: "这次改动暂时有效，重新打开后恢复为上次保存的值。" });
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export const pluginSettingsActions = {
  /** Stores a value that fits its field; returns the problem otherwise. */
  set(pluginId: string, field: PluginSettingField, value: PluginSettingValue): string | undefined {
    const problem = settingProblem(field, value);
    if (problem) return problem;
    const all = current();
    commit({ ...all, [pluginId]: { ...all[pluginId], [field.key]: value } });
    return undefined;
  },
  /** Back to the declared defaults for these fields. */
  reset(pluginId: string, fields: readonly PluginSettingField[]) {
    const all = current();
    const kept = Object.fromEntries(Object.entries(all[pluginId] ?? {}).filter(([key]) => !fields.some((field) => field.key === key)));
    const { [pluginId]: _removed, ...rest } = all;
    commit(Object.keys(kept).length ? { ...rest, [pluginId]: kept } : rest);
  },
  /** Forgets a removed plugin's values. */
  forget(pluginId: string) {
    const all = current();
    if (!Object.prototype.hasOwnProperty.call(all, pluginId)) return;
    const { [pluginId]: _removed, ...rest } = all;
    commit(rest);
  },
};

/** Every plugin's stored values (fields not stored read as their defaults). */
export function usePluginSettingValues(): PluginSettingsStore {
  return useSyncExternalStore(subscribe, current, current);
}
