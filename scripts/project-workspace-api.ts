import type { IncomingMessage, ServerResponse } from "node:http";
import { execFile } from "node:child_process";
import { open, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, normalize, sep } from "node:path";
import type { Connect, Plugin } from "vite";

/**
 * Project folder views for the browser preview (Vite dev and preview
 * servers), which cannot use the desktop host. Mirrors
 * src-tauri/src/project_workspace.rs: list a folder, read a text file, and
 * `git status` / `git diff`, read-only and confined to the project root.
 * JSON POSTs only, so other sites cannot read results without a CORS
 * preflight this server never answers.
 */
export function projectWorkspaceApi(): Plugin {
  const middleware = createProjectWorkspaceMiddleware();
  return {
    name: "nekopapa-project-workspace-api",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

const PREFIX = "/api/project-workspace/";
const MAX_ENTRIES = 2000;
const MAX_FILE = 512 * 1024;
const MAX_GIT_OUTPUT = 2 * 1024 * 1024;

class Refusal extends Error {}

async function rootOf(root: unknown): Promise<string> {
  if (typeof root !== "string" || !isAbsolute(root)) throw new Refusal("项目文件夹必须是完整路径。");
  let resolved: string;
  try { resolved = await realpath(root); } catch { throw new Refusal("项目文件夹不存在或无法访问。"); }
  if (!(await stat(resolved)).isDirectory()) throw new Refusal("项目路径不是文件夹。");
  return resolved;
}

function relative(path: unknown): string {
  if (typeof path !== "string" || path.length > 4096 || isAbsolute(path) || path.includes("\0")) throw new Refusal("路径无效。");
  const parts = normalize(path || ".").split(/[\\/]/);
  if (parts.includes("..")) throw new Refusal("路径无效。");
  return path;
}

/** Resolves symlinks, then confirms the result is still inside the root. */
async function inside(root: string, path: unknown): Promise<string> {
  const target = join(root, relative(path));
  let resolved: string;
  try { resolved = await realpath(target); } catch { throw new Refusal("文件不存在或无法访问。"); }
  if (resolved !== root && !resolved.startsWith(root + sep)) throw new Refusal("该路径指向项目文件夹之外。");
  return resolved;
}

export async function listProject(root: unknown, dir: unknown) {
  const base = await rootOf(root);
  const folder = await inside(base, dir);
  const prefix = relative(dir).replace(/^\.?\/?/, "").replace(/\/$/, "");
  let truncated = false;
  const entries: { name: string; path: string; kind: "dir" | "file" | "link"; size: number }[] = [];
  for (const item of await readdir(folder, { withFileTypes: true })) {
    if (item.name === ".git") continue;
    if (entries.length >= MAX_ENTRIES) { truncated = true; break; }
    const kind = item.isSymbolicLink() ? "link" : item.isDirectory() ? "dir" : "file";
    const size = kind === "file" ? (await stat(join(folder, item.name)).catch(() => ({ size: 0 }))).size : 0;
    entries.push({ name: item.name, path: prefix ? `${prefix}/${item.name}` : item.name, kind, size });
  }
  entries.sort((a, b) => Number(a.kind !== "dir") - Number(b.kind !== "dir") || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return { entries, truncated };
}

export async function readProject(root: unknown, path: unknown) {
  const base = await rootOf(root);
  const file = await inside(base, path);
  const info = await stat(file);
  if (!info.isFile()) throw new Refusal("这不是文件。");
  const view = { path: path as string, size: info.size, binary: false, tooLarge: info.size > MAX_FILE };
  if (view.tooLarge) return view;
  const handle = await open(file, "r");
  try {
    const bytes = await handle.readFile();
    const text = new TextDecoder("utf-8", { fatal: true });
    try {
      const decoded = text.decode(bytes);
      return decoded.includes("\0") ? { ...view, binary: true } : { ...view, text: decoded };
    } catch { return { ...view, binary: true }; }
  } finally { await handle.close(); }
}

function git(root: string, args: string[]): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile("git", ["-C", root, "-c", "core.quotepath=false", "-c", "color.ui=false", ...args],
      { env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" }, maxBuffer: MAX_GIT_OUTPUT, encoding: "utf8" },
      (error, stdout) => {
        if (error && (error as NodeJS.ErrnoException).code === "ENOENT") { reject(new Refusal("找不到 git 命令。请先安装 Git。")); return; }
        if (error && /maxBuffer/i.test(error.message)) { reject(new Refusal("变化太多，无法在这里显示。")); return; }
        resolve({ ok: !error, stdout });
      });
  });
}

export async function gitStatus(root: unknown) {
  const base = await rootOf(root);
  const result = await git(base, ["status", "--porcelain=v1", "-z", "-b", "--untracked-files=all"]);
  return result.ok ? { repo: true, output: result.stdout } : { repo: false, output: "" };
}

export async function gitDiff(root: unknown, path: unknown) {
  const base = await rootOf(root);
  const file = relative(path);
  let result = await git(base, ["diff", "--no-ext-diff", "HEAD", "--", file]);
  // A repository without commits has no HEAD: compare the index instead.
  if (!result.ok) result = await git(base, ["diff", "--no-ext-diff", "--cached", "--", file]);
  if (!result.ok) throw new Refusal("Git 无法读取这个文件的差异。");
  return { repo: true, output: result.stdout };
}

const routes: Record<string, (input: Record<string, unknown>) => Promise<unknown>> = {
  list: (input) => listProject(input.root, input.dir),
  read: (input) => readProject(input.root, input.path),
  "git-status": (input) => gitStatus(input.root),
  "git-diff": (input) => gitDiff(input.root, input.path),
};

export function createProjectWorkspaceMiddleware(): Connect.NextHandleFunction {
  return (request, response, next) => {
    const path = request.url?.split("?", 1)[0] ?? "";
    if (!path.startsWith(PREFIX) || !routes[path.slice(PREFIX.length)]) { next(); return; }
    void handle(request, response, routes[path.slice(PREFIX.length)]);
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, route: (input: Record<string, unknown>) => Promise<unknown>) {
  const reply = (status: number, body: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(body));
  };
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); reply(405, { error: "只接受 POST。" }); return; }
  if (!request.headers["content-type"]?.startsWith("application/json")) { reply(415, { error: "需要 JSON。" }); return; }
  let input: Record<string, unknown>;
  try {
    let body = "";
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 16384) { reply(413, { error: "请求过大。" }); return; }
    }
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object") throw new Error();
    input = parsed as Record<string, unknown>;
  } catch {
    reply(400, { error: "请求格式无效。" });
    return;
  }
  try {
    reply(200, await route(input));
  } catch (error) {
    reply(400, { error: error instanceof Refusal ? error.message : "读取失败。" });
  }
}
