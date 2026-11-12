import { invoke } from "@tauri-apps/api/core";
import type { AgentHost, CommandResult, FileChange, SearchResult } from "@/app/agent/agent-host";
import { readCommandResult, readFileChange, readSearchResult } from "@/app/agent/agent-host";
import { projectWorkspace } from "@/app/projects/project-workspace-client";

/**
 * The chat Agent's tools in the desktop app: reading and listing reuse the
 * project panels' commands; search, writes, undo and commands are
 * src-tauri/src/agent_tools.rs and agent_command.rs.
 */

const fail = (error: unknown, fallback: string) => new Error(typeof error === "string" ? error : fallback);

async function call<T>(command: string, args: Record<string, unknown>, read: (value: unknown) => T | undefined, fallback: string): Promise<T> {
  let value: unknown;
  try { value = await invoke(command, args); } catch (error) { throw fail(error, fallback); }
  const result = read(value);
  if (!result) throw new Error(fallback);
  return result;
}

let nextCommand = 1;

export const desktopAgentHost: AgentHost = {
  list: (root, dir) => projectWorkspace.list(root, dir),
  read: (root, path) => projectWorkspace.read(root, path),
  search: (root, query, limit): Promise<SearchResult> =>
    call("agent_search", { root, query, limit }, readSearchResult, "无法搜索项目文件。"),
  write: (root, path, text): Promise<FileChange> =>
    call("agent_write_file", { root, path, text }, readFileChange, "无法写入文件。"),
  edit: (root, path, oldText, newText): Promise<FileChange> =>
    call("agent_edit_file", { root, path, old: oldText, new: newText }, readFileChange, "无法修改文件。"),
  run: async (root, command, timeoutSeconds, signal): Promise<CommandResult> => {
    const id = nextCommand++;
    const cancel = () => { void invoke("agent_cancel_command", { id }); };
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      return await call("agent_run_command", { id, root, command, timeout: timeoutSeconds }, readCommandResult, "无法运行命令。");
    } finally { signal?.removeEventListener("abort", cancel); }
  },
};

export type SnapshotState = "ready" | "undone" | "changed";

/** Whether a change card can still undo its change. */
export async function snapshotState(snapshot: string): Promise<SnapshotState> {
  try {
    const state = await invoke<string>("agent_snapshot_state", { snapshot });
    return state === "ready" || state === "changed" ? state : "undone";
  } catch (error) { throw fail(error, "无法读取快照。"); }
}

/** Puts a file back as it was before the Agent changed it. */
export async function undoChange(snapshot: string): Promise<void> {
  try { await invoke("agent_undo", { snapshot }); } catch (error) { throw fail(error, "无法撤销这次修改。"); }
}
