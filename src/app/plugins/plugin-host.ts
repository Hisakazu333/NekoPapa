import { isTauri } from "@tauri-apps/api/core";
import { hostCall } from "../projects/project-workspace-client";
import { PLUGIN_REQUIREMENTS, type PluginRequirement } from "./plugin-manifest";
import { DEV_FRAME_PREFIX, PLUGIN_FRAME_SCHEME, frameSegments } from "./plugin-frame-paths";

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

/**
 * Where frame files are served: the app's own scheme on desktop (Windows
 * spells custom schemes as http://<scheme>.localhost), the dev server's
 * route in the browser preview.
 */
export function pluginFrameBase(): string {
  if (!isTauri()) return `${location.origin}${DEV_FRAME_PREFIX}`;
  return /Windows/i.test(navigator.userAgent) ? `http://${PLUGIN_FRAME_SCHEME}.localhost/` : `${PLUGIN_FRAME_SCHEME}://localhost/`;
}

/** The address of a plugin's frame page, or undefined for a path the host would refuse. */
export function pluginFrameUrl(pluginId: string, entry: string): string | undefined {
  const segments = frameSegments(entry);
  return segments ? `${pluginFrameBase()}${pluginId}/${segments.map(encodeURIComponent).join("/")}` : undefined;
}

/** Lets the host serve this plugin's folder; the host checks the folder's manifest is the plugin's. */
export const allowPluginFrame = (pluginId: string, folder: string): Promise<void> =>
  hostCall("plugin_frame_allow", "plugins/frame-allow", { pluginId, folder }, () => undefined);

export const revokePluginFrame = (pluginId: string): Promise<void> =>
  hostCall("plugin_frame_revoke", "plugins/frame-revoke", { pluginId }, () => undefined);
