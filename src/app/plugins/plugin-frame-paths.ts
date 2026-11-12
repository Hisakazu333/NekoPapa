/**
 * Paths of interface plugins' frame views (docs/plugin-slots.md, stage 3),
 * shared by the manifest check, the frame view and the browser preview's
 * server. src-tauri/src/plugin_frame.rs applies the same rules on desktop.
 *
 * A frame file is `<base><plugin id>/<segments>`. Segments may only use
 * letters, digits, `.`, `_` and `-` and may not start with a dot, so `..`,
 * hidden files and encoded slashes never resolve; at most 12 deep.
 */

export const PLUGIN_FRAME_SCHEME = "nekopapa-plugin";
export const PLUGIN_SDK_PATH = "__sdk/plugin-bridge.js";
/** Where the browser preview serves frame files. */
export const DEV_FRAME_PREFIX = "/plugin-frame/";

const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$/;
const PLUGIN_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export const FRAME_FILE_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8", json: "application/json; charset=utf-8", txt: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", ico: "image/x-icon",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf",
};

export const frameFileType = (name: string): string | undefined => {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? undefined : FRAME_FILE_TYPES[name.slice(dot + 1).toLowerCase()];
};

/** The segments of a relative file path in a plugin folder, or undefined when it is not allowed. */
export function frameSegments(path: string): string[] | undefined {
  const segments = path.split("/");
  return segments.length > 0 && segments.length <= 12 && segments.every((segment) => SEGMENT.test(segment)) ? segments : undefined;
}

/** A manifest's `content.entry`: an allowed path to an .html file. */
export const isFrameEntry = (entry: string) => {
  const segments = frameSegments(entry);
  return Boolean(segments) && /\.html?$/i.test(entry);
};

/** Splits a served path (after the base) into plugin id and file segments. */
export function splitFramePath(path: string): { pluginId: string; segments: string[] } | undefined {
  let parts: string[];
  try { parts = path.replace(/^\/+/, "").split("/").map((part) => decodeURIComponent(part)); } catch { return undefined; }
  const [pluginId, ...rest] = parts;
  if (!pluginId || !PLUGIN_ID.test(pluginId) || pluginId.length > 100) return undefined;
  const segments = frameSegments(rest.join("/"));
  return segments && rest.length > 0 && rest.every((part) => !part.includes("/")) ? { pluginId, segments } : undefined;
}

/**
 * The CSP every frame file of `pluginId` is served with: its own files and
 * the bridge script, inline styles, images from data/blob URLs; no network,
 * frames, workers, plugins, forms or base URL changes.
 */
export function frameCsp(pluginId: string, bases: readonly string[]): string {
  const own = bases.map((base) => `${base}${pluginId}/ ${base.replace(/plugin-frame\/$/, "")}__sdk/`).join(" ");
  return `default-src 'none'; script-src ${own}; style-src ${own} 'unsafe-inline'; img-src ${own} data: blob:; font-src ${own}; media-src ${own}; `
    + "connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
}
