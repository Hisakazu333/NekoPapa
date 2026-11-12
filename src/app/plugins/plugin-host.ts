import { isTauri } from "@tauri-apps/api/core";
import { hostCall } from "../projects/project-workspace-client";
import { PLUGIN_REQUIREMENTS, type PluginRequirement } from "./plugin-manifest";

/**
 * What the host gives interface plugins: reading a plugin folder's manifest
 * (desktop command, or the dev server in the browser preview) and the real
 * state of each requirement. Coding and the NekoBuddy backend are not
 * connected yet, so entries that need them say so instead of pretending.
 */

export interface ManifestFile { folder: string; text: string }

const readManifestFile = (value: unknown): ManifestFile => {
  const file = value as Partial<ManifestFile> | null;
  if (!file || typeof file.folder !== "string" || typeof file.text !== "string") throw new Error("读取结果格式不对。");
  return { folder: file.folder, text: file.text };
};

/** Reads `nekopapa-plugin.json` from a folder; rejects with a message ready to show. */
export const readPluginFolder = (folder: string): Promise<ManifestFile> =>
  hostCall("plugin_manifest_read", "plugins/manifest", { folder }, readManifestFile);

const met: Record<PluginRequirement, () => boolean> = {
  desktop: () => isTauri(),
  "runtime.coding": () => false,
  "backend.nekobuddy": () => false,
};

/** Why an entry cannot be used now, or undefined when every requirement is met. */
export function unmetRequirement(requires: readonly PluginRequirement[]): string | undefined {
  const missing = requires.find((requirement) => !met[requirement]());
  return missing ? `${PLUGIN_REQUIREMENTS[missing]}，当前不可用。` : undefined;
}
