import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Connect, Plugin } from "vite";
import { DEV_FRAME_PREFIX, PLUGIN_SDK_PATH, frameCsp, frameFileType, splitFramePath } from "../src/app/plugins/plugin-frame-paths";
import { readPluginManifest } from "./plugin-manifest-api";

/**
 * Interface plugins' frame views in the browser preview. Mirrors
 * src-tauri/src/plugin_frame.rs: `POST /api/plugins/frame-allow` checks a
 * folder's manifest belongs to the plugin and remembers it (in this server
 * process only), `GET /plugin-frame/<id>/<path>` serves its static files
 * with the frame CSP, and `/__sdk/plugin-bridge.js` the bridge script (the
 * same file the desktop app embeds). JSON POST only, as the manifest API.
 */
export function pluginFrameApi(): Plugin {
  const middleware = createPluginFrameMiddleware();
  return {
    name: "nekopapa-plugin-frame-api",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

const MAX_FILE = 8 * 1024 * 1024;
const SDK_FILE = fileURLToPath(new URL("../src-tauri/src/plugin_bridge_sdk.js", import.meta.url));

export function createPluginFrameMiddleware(folders = new Map<string, string>()): Connect.NextHandleFunction {
  return (request, response, next) => {
    const path = request.url?.split("?", 1)[0] ?? "";
    if (path === "/api/plugins/frame-allow" || path === "/api/plugins/frame-revoke") { void control(path, request, response, folders); return; }
    if (path === `/${PLUGIN_SDK_PATH}`) { void sdk(request, response); return; }
    if (path.startsWith(DEV_FRAME_PREFIX)) { void file(path.slice(DEV_FRAME_PREFIX.length), request, response, folders); return; }
    next();
  };
}

function send(response: ServerResponse, status: number, type: string, body: string | Buffer, csp = "default-src 'none'") {
  response.writeHead(status, {
    "Content-Type": type, "Content-Security-Policy": csp, "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Access-Control-Allow-Origin": "*",
  });
  response.end(body);
}

async function sdk(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "GET" && request.method !== "HEAD") { send(response, 405, "text/plain; charset=utf-8", ""); return; }
  send(response, 200, "text/javascript; charset=utf-8", await readFile(SDK_FILE));
}

async function file(rest: string, request: IncomingMessage, response: ServerResponse, folders: Map<string, string>) {
  if (request.method !== "GET" && request.method !== "HEAD") { send(response, 405, "text/plain; charset=utf-8", ""); return; }
  const missing = (csp?: string) => send(response, 404, "text/plain; charset=utf-8", "找不到这个插件文件。", csp);
  const target = splitFramePath(rest);
  if (!target) { missing(); return; }
  const csp = frameCsp(target.pluginId, [`http://${request.headers.host ?? "127.0.0.1"}${DEV_FRAME_PREFIX}`]);
  const type = frameFileType(target.segments[target.segments.length - 1]);
  const root = folders.get(target.pluginId);
  if (!type || !root) { missing(csp); return; }
  try {
    const resolved = await realpath(join(root, ...target.segments));
    const info = await stat(resolved);
    if (!resolved.startsWith(root + sep) || !info.isFile() || info.size > MAX_FILE) { missing(csp); return; }
    send(response, 200, type, await readFile(resolved), csp);
  } catch { missing(csp); }
}

async function control(path: string, request: IncomingMessage, response: ServerResponse, folders: Map<string, string>) {
  const reply = (status: number, value: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(value));
  };
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); reply(405, { error: "只接受 POST。" }); return; }
  if (!request.headers["content-type"]?.startsWith("application/json")) { reply(415, { error: "需要 JSON。" }); return; }
  let body: { pluginId?: unknown; folder?: unknown };
  try {
    let raw = "";
    for await (const chunk of request) { raw += chunk; if (raw.length > 8192) throw new Error("too large"); }
    body = JSON.parse(raw) ?? {};
  } catch { reply(400, { error: "请求格式不对。" }); return; }
  if (typeof body.pluginId !== "string") { reply(400, { error: "缺少插件 id。" }); return; }
  if (path.endsWith("revoke")) { folders.delete(body.pluginId); reply(200, { ok: true }); return; }
  if (typeof body.folder !== "string") { reply(400, { error: "缺少插件文件夹。" }); return; }
  try {
    const manifest = await readPluginManifest(body.folder);
    let id: unknown;
    try { id = (JSON.parse(manifest.text) as { id?: unknown })?.id; } catch { throw new Error("插件清单不是有效的 JSON。"); }
    if (id !== body.pluginId) throw new Error("插件文件夹里的清单不是这个插件的。");
    folders.set(body.pluginId, manifest.folder);
    reply(200, { ok: true });
  } catch (error) { reply(400, { error: error instanceof Error ? error.message : "读取失败。" }); }
}
