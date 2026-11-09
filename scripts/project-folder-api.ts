import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import type { Connect, Plugin } from "vite";
import { folderProblem, parseGitHead, type ProjectFolderCheck } from "../src/app/project-folder-info";

/**
 * Folder check for the browser preview (Vite dev and preview servers), which
 * cannot use the desktop host. Mirrors `inspect_project_folder` in
 * src-tauri/src/project_folder.rs: resolves the path, confirms it is a folder
 * and reads its Git HEAD. Only JSON POSTs are accepted, so other sites cannot
 * read results without a CORS preflight this server never answers.
 */
export function projectFolderApi(): Plugin {
  const middleware = createProjectFolderMiddleware();
  return {
    name: "nekopapa-project-folder-api",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

export function createProjectFolderMiddleware(home = homedir()): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (request.url?.split("?", 1)[0] !== "/api/project-folder") { next(); return; }
    void handle(request, response, home);
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, home: string) {
  const reply = (status: number, body: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(body));
  };
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); reply(405, { error: "method_not_allowed" }); return; }
  if (!request.headers["content-type"]?.startsWith("application/json")) { reply(415, { error: "json_required" }); return; }
  let input: unknown;
  try {
    let body = "";
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 4096) { reply(413, { error: "too_large" }); return; }
    }
    input = (JSON.parse(body) as { path?: unknown }).path;
  } catch {
    reply(400, { error: "invalid_json" });
    return;
  }
  reply(200, await inspectProjectFolder(input, home));
}

/** Expands `~`, resolves symlinks and reads Git HEAD; never lists the folder. */
export async function inspectProjectFolder(input: unknown, home: string): Promise<ProjectFolderCheck> {
  if (typeof input !== "string") return folderProblem("invalid");
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 1024 || /[\u0000-\u001f]/.test(trimmed)) return folderProblem("invalid");
  const expanded = trimmed === "~" ? home : trimmed.startsWith("~/") ? join(home, trimmed.slice(2)) : trimmed;
  if (!isAbsolute(expanded)) return folderProblem("invalid");
  let path: string;
  try {
    path = await realpath(expanded);
    if (!(await stat(path)).isDirectory()) return folderProblem("not_directory");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return folderProblem("not_found");
    if (code === "EACCES" || code === "EPERM") return folderProblem("denied");
    return folderProblem("unavailable");
  }
  const git = await readGit(path);
  return { ok: true, folder: { path, name: basename(path) || path, ...(git ? { git } : {}) } };
}

async function readGit(folder: string) {
  for (let current = folder; ; current = dirname(current)) {
    const marker = join(current, ".git");
    try {
      const info = await stat(marker);
      let gitDir = marker;
      let worktree = false;
      if (info.isFile()) {
        const pointer = /^gitdir:\s*(.+)$/m.exec(await readFile(marker, "utf8"))?.[1]?.trim();
        if (!pointer) return undefined;
        gitDir = resolve(current, pointer);
        worktree = /[\\/]worktrees[\\/]/.test(gitDir);
      }
      return { ...parseGitHead(await readFile(join(gitDir, "HEAD"), "utf8")), worktree };
    } catch {
      // No readable .git here; keep walking up.
    }
    if (dirname(current) === current) return undefined;
  }
}
