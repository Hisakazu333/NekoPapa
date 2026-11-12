import { checkPluginManifest, grantablePermissions, type ManifestCheck, type PluginManifest } from "./plugin-manifest";

/**
 * The interface plugins added on this device, kept in local storage under
 * `nekopapa.ui-plugins.v1`: the folder, the checked manifest, whether it is
 * enabled and the permissions the user granted. The manifest is stored as
 * checked so the workbench shows enabled plugins at once; each start reads
 * the folder again, and a manifest that is gone, broken or asks for new
 * permissions turns the plugin off with the reason. Unreadable records are
 * copied to a backup key and the list starts empty.
 */
export const PLUGIN_RECORDS_KEY = "nekopapa.ui-plugins.v1";
export const PLUGIN_RECORDS_BACKUP_KEY = `${PLUGIN_RECORDS_KEY}.corrupt`;

export interface PluginRecord {
  id: string;
  /** Absolute folder holding nekopapa-plugin.json. */
  folder: string;
  manifest: PluginManifest;
  enabled: boolean;
  /** Permissions the user confirmed; a manifest asking for more turns the plugin off. */
  granted: string[];
  /** Why the plugin is off when the app turned it off; cleared when the user turns it on again. */
  problem?: string;
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export type PluginRecordsRead = { records: PluginRecord[]; status: "ok" | "empty" | "corrupt" | "unavailable" };

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** A stored record is kept only when its manifest still checks out as stored. */
function readRecord(value: unknown): PluginRecord | undefined {
  if (!isObject(value) || typeof value.folder !== "string" || typeof value.enabled !== "boolean" || !Array.isArray(value.granted)) return undefined;
  if (!value.granted.every((item) => typeof item === "string")) return undefined;
  const check = checkPluginManifest(JSON.stringify(toManifestSource(value.manifest)));
  if (!check.ok || check.manifest.id !== value.id) return undefined;
  return {
    id: check.manifest.id, folder: value.folder, manifest: check.manifest, enabled: value.enabled, granted: value.granted as string[],
    ...(typeof value.problem === "string" ? { problem: value.problem } : {}),
  };
}

/** The checked manifest back in manifest form, so stored records go through the same check. */
export function toManifestSource(manifest: unknown): unknown {
  if (!isObject(manifest) || !Array.isArray(manifest.views) || !Array.isArray(manifest.commands)) return manifest;
  // Records saved before settings pages existed have no `settings`.
  const { views, commands, settings = [], engine, cordis, ...rest } = manifest as unknown as PluginManifest;
  const local = (id: string) => id.slice(id.indexOf("/") + 1);
  return {
    ...rest,
    engines: { nekopapa: engine },
    ...(cordis ? { runtime: { cordis } } : {}),
    contributes: {
      ...(views.length ? { "workPanel.view": views.map(({ localId, id: _id, ...view }) => ({ ...view, id: localId })) } : {}),
      ...(commands.length ? { "command.palette": commands.map(({ localId, id: _id, action, ...command }) => ({
        ...command, id: localId,
        action: "openView" in action ? { openView: local(action.openView) } : "openSettings" in action ? { openSettings: local(action.openSettings) } : action,
      })) } : {}),
      ...(settings.length ? { "settings.section": settings.map(({ localId, id: _id, ...section }) => ({ ...section, id: localId })) } : {}),
    },
  };
}

export function readPluginRecords(storage: Storage | undefined): PluginRecordsRead {
  let text: string | null;
  try {
    if (!storage) return { records: [], status: "unavailable" };
    text = storage.getItem(PLUGIN_RECORDS_KEY);
  } catch {
    return { records: [], status: "unavailable" };
  }
  if (text === null) return { records: [], status: "empty" };
  let value: unknown;
  try { value = JSON.parse(text); } catch { value = undefined; }
  const list = isObject(value) && Array.isArray(value.plugins) ? value.plugins : undefined;
  const records = list?.map(readRecord);
  if (!records || records.some((record) => !record) || new Set(records.map((record) => record!.id)).size !== records.length) {
    try { storage.setItem(PLUGIN_RECORDS_BACKUP_KEY, text); } catch { /* the list still starts empty */ }
    return { records: [], status: "corrupt" };
  }
  return { records: records as PluginRecord[], status: "ok" };
}

/** Returns false when the list could not be saved (the change holds until reload). */
export function writePluginRecords(storage: Storage | undefined, records: readonly PluginRecord[]): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PLUGIN_RECORDS_KEY, JSON.stringify({ plugins: records }));
    return true;
  } catch {
    return false;
  }
}

/** Adds (or replaces, same id) a plugin the user confirmed, enabled with its open permissions. */
export function addPlugin(records: readonly PluginRecord[], folder: string, manifest: PluginManifest): PluginRecord[] {
  const record: PluginRecord = { id: manifest.id, folder, manifest, enabled: true, granted: grantablePermissions(manifest) };
  const at = records.findIndex((existing) => existing.id === manifest.id);
  return at < 0 ? [...records, record] : records.map((existing, index) => (index === at ? record : existing));
}

export const removePlugin = (records: readonly PluginRecord[], id: string) => records.filter((record) => record.id !== id);

/** Turning a plugin on by hand clears the app's reason for turning it off. */
export function setPluginEnabled(records: readonly PluginRecord[], id: string, enabled: boolean): PluginRecord[] {
  return records.map((record) => {
    if (record.id !== id) return record;
    const { problem: _problem, ...rest } = record;
    return enabled ? { ...rest, enabled: true } : { ...record, enabled: false };
  });
}

/** Permissions the manifest now asks for that the user has not granted. */
export const ungrantedPermissions = (record: Pick<PluginRecord, "granted">, manifest: PluginManifest) =>
  grantablePermissions(manifest).filter((permission) => !record.granted.includes(permission));

export type ManifestReading = { check: ManifestCheck } | { error: string };

/**
 * Applies a fresh read of the plugin's folder. A good manifest with the same
 * id and no new permissions replaces the stored one (and turns back on a
 * plugin the app had turned off); anything else turns the plugin off and
 * says why, keeping the last good manifest.
 */
export function refreshPlugin(records: readonly PluginRecord[], id: string, reading: ManifestReading): PluginRecord[] {
  return records.map((record) => {
    if (record.id !== id) return record;
    // A plugin the user turned off stays as it is until they turn it on again.
    const userOff = !record.enabled && record.problem === undefined;
    const off = (problem: string): PluginRecord => (userOff ? record : { ...record, enabled: false, problem });
    if ("error" in reading) return off(`读取清单失败：${reading.error}`);
    if (!reading.check.ok) return off(`清单有问题：${reading.check.errors[0]}${reading.check.errors.length > 1 ? `（共 ${reading.check.errors.length} 处）` : ""}`);
    const manifest = reading.check.manifest;
    if (manifest.id !== record.id) return off(`清单的 id 变成了“${manifest.id}”，需要重新添加。`);
    const added = ungrantedPermissions(record, manifest);
    if (added.length > 0) return off(`新版本请求了新的权限：${added.join("、")}，需要重新添加并确认。`);
    // Fixed after the app turned it off: back on, as the user left it.
    const { problem, ...rest } = record;
    return { ...rest, manifest, enabled: record.enabled || problem !== undefined };
  });
}
