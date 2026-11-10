import { invoke, isTauri } from "@tauri-apps/api/core";
import { readGitOutput, readListing, readProjectFile, type GitOutput, type ProjectFile, type ProjectListing } from "./project-workspace";

const UNAVAILABLE = "当前页面不能读取本机文件夹。请在 NekoPapa 桌面应用或本地开发服务器中打开。";

async function call<T>(command: string, route: string, args: Record<string, string>, read: (value: unknown) => T): Promise<T> {
  if (isTauri()) {
    try { return read(await invoke(command, args)); } catch (error) { throw new Error(typeof error === "string" ? error : error instanceof Error ? error.message : "读取失败。"); }
  }
  let response: Response;
  try {
    response = await fetch(`/api/project-workspace/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) });
  } catch {
    throw new Error(UNAVAILABLE);
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 404 || !body) throw new Error(UNAVAILABLE);
  if (!response.ok) throw new Error(typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "读取失败。");
  return read(body);
}

/**
 * The project folder views: the desktop host answers through its commands,
 * the browser preview through the dev server. Errors carry a message ready
 * to show.
 */
export const projectWorkspace = {
  list: (root: string, dir: string): Promise<ProjectListing> => call("project_list_dir", "list", { root, dir }, readListing),
  read: (root: string, path: string): Promise<ProjectFile> => call("project_read_file", "read", { root, path }, readProjectFile),
  status: (root: string): Promise<GitOutput> => call("project_git_status", "git-status", { root }, readGitOutput),
  diff: (root: string, path: string): Promise<GitOutput> => call("project_git_diff", "git-diff", { root, path }, readGitOutput),
};
