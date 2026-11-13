import { Channel, invoke } from "@tauri-apps/api/core";
import type { AgentHost, CommandResult, FileChange, SearchResult } from "@/app/agent/agent-host";
import { readCommandResult, readFileChange, readSearchResult } from "@/app/agent/agent-host";
import { projectWorkspace } from "@/app/projects/project-workspace-client";
import { ANY_PROJECT, announceProjectChange } from "@/app/agent/project-change-events";

/**
 * The chat Agent's tools in the desktop app: reading and listing reuse the
 * project panels' commands; the file index and search are
 * src-tauri/src/project_files.rs; writes, undo and commands are
 * agent_tools.rs and agent_command.rs.
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

/** Tells the 更改 panel to refresh once the call is done, whether it worked or not. */
async function changed<T>(root: string, job: Promise<T>): Promise<T> {
  try { return await job; } finally { announceProjectChange(root); }
}

export const desktopAgentHost: AgentHost = {
  list: (root, dir) => projectWorkspace.list(root, dir),
  read: (root, path) => projectWorkspace.read(root, path),
  files: (root) => projectWorkspace.files(root),
  search: (root, query, limit): Promise<SearchResult> =>
    call("agent_search", { root, query: query.text, regex: query.regex, caseSensitive: query.caseSensitive, pathPattern: query.pathPattern ?? null, limit }, readSearchResult, "无法搜索项目文件。"),
  write: (root, path, text): Promise<FileChange> =>
    changed(root, call("agent_write_file", { root, path, text }, readFileChange, "无法写入文件。")),
  edit: (root, path, edits): Promise<FileChange> =>
    changed(root, call("agent_edit_file", { root, path, edits: edits.map((edit) => ({ old: edit.oldText, new: edit.newText, replaceAll: edit.replaceAll === true })) }, readFileChange, "无法修改文件。")),
  run: async (root, command, timeoutSeconds, signal, onOutput): Promise<CommandResult> => {
    const id = nextCommand++;
    // Output arrives here as the command prints it; the result still carries all of it.
    const output = new Channel<{ stream: string; text: string }>();
    output.onmessage = (chunk) => { if (typeof chunk?.text === "string") onOutput?.(chunk.text); };
    const cancel = () => { void invoke("agent_cancel_command", { id }); };
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      // A command may change files too (formatters, generators, git).
      return await changed(root, call("agent_run_command", { id, root, command, timeout: timeoutSeconds, onOutput: output }, readCommandResult, "无法运行命令。"));
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
  // The snapshot knows its folder, the card does not: every open 更改 panel refreshes.
  announceProjectChange(ANY_PROJECT);
}
