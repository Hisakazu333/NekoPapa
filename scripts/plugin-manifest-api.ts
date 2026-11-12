import type { IncomingMessage, ServerResponse } from "node:http";
import { open, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import type { Connect, Plugin } from "vite";

/**
 * 设置 → 界面插件 for the browser preview. Mirrors
 * src-tauri/src/plugin_manifest.rs: reads only `nekopapa-plugin.json`
 * directly inside the given absolute folder (no symlink out of it, at most
 * 256 KB, UTF-8) and returns its text. Nothing is executed, listed or
 * written. JSON POST only, so other sites cannot read the result without a
 * CORS preflight this server never answers.
 */
export function pluginManifestApi(): Plugin {
  const middleware = createPluginManifestMiddleware();
  return {
    name: "nekopapa-plugin-manifest-api",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

const ROUTE = "/api/plugins/manifest";
const MANIFEST_FILE = "nekopapa-plugin.json";
const MAX_MANIFEST = 256 * 1024;

export async function readPluginManifest(folder: string): Promise<{ folder: string; text: string }> {
  if (!isAbsolute(folder)) throw new Error("插件文件夹必须是完整路径。");
  let root: string;
  try { root = await realpath(folder); } catch { throw new Error("插件文件夹不存在或无法访问。"); }
  if (!(await stat(root)).isDirectory()) throw new Error("所选路径不是文件夹。");
  let resolved: string;
  try { resolved = await realpath(join(root, MANIFEST_FILE)); } catch { throw new Error(`文件夹里没有 ${MANIFEST_FILE}。`); }
  if (dirname(resolved) !== root) throw new Error(`${MANIFEST_FILE} 指向了文件夹以外的位置。`);
  const info = await stat(resolved);
  if (!info.isFile()) throw new Error(`${MANIFEST_FILE} 不是文件。`);
  if (info.size > MAX_MANIFEST) throw new Error(`${MANIFEST_FILE} 超过 256 KB。`);
  const file = await open(resolved, "r");
  let bytes: Buffer;
  try {
    const buffer = Buffer.alloc(info.size);
    const { bytesRead } = await file.read(buffer, 0, info.size, 0);
    bytes = buffer.subarray(0, bytesRead);
  } finally { await file.close(); }
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error(`${MANIFEST_FILE} 不是 UTF-8 文本。`); }
  return { folder: root, text };
}

export function createPluginManifestMiddleware(): Connect.NextHandleFunction {
  return (request, response, next) => {
    if ((request.url?.split("?", 1)[0] ?? "") !== ROUTE) { next(); return; }
    void handle(request, response);
  };
}

async function body(request: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 8192) throw new Error("请求太大。");
  }
  return JSON.parse(raw);
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const reply = (status: number, value: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(value));
  };
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); reply(405, { error: "只接受 POST。" }); return; }
  if (!request.headers["content-type"]?.startsWith("application/json")) { reply(415, { error: "需要 JSON。" }); return; }
  let folder: unknown;
  try { folder = (await body(request) as { folder?: unknown })?.folder; } catch { reply(400, { error: "请求格式不对。" }); return; }
  if (typeof folder !== "string") { reply(400, { error: "缺少插件文件夹。" }); return; }
  try { reply(200, await readPluginManifest(folder)); } catch (error) { reply(400, { error: error instanceof Error ? error.message : "读取失败。" }); }
}
