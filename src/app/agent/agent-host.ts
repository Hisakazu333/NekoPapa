import type { ProjectFile, ProjectListing } from "../projects/project-workspace";

/**
 * What the chat Agent can do on this computer, inside one project folder.
 * The desktop app provides it (src/platform/desktop-agent-host.ts, backed by
 * src-tauri/src/agent_tools.rs and agent_command.rs); the dev server's Node
 * process does not, so chats there have no tools and say so.
 */
export interface AgentHost {
  list(root: string, dir: string): Promise<ProjectListing>;
  read(root: string, path: string): Promise<ProjectFile>;
  search(root: string, query: string, limit: number): Promise<SearchResult>;
  write(root: string, path: string, text: string): Promise<FileChange>;
  edit(root: string, path: string, oldText: string, newText: string): Promise<FileChange>;
  run(root: string, command: string, timeoutSeconds: number, signal?: AbortSignal): Promise<CommandResult>;
}

export interface SearchHit { path: string; line: number; text: string }
export interface SearchResult { hits: SearchHit[]; truncated: boolean }

/** One file the Agent wrote, as the host reports it: the diff and the snapshot that undoes it. */
export interface FileChange { path: string; created: boolean; added: number; removed: number; diff: string; snapshot: string }

export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
  truncated: boolean;
  durationMs: number;
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

/** A saved tool output read back as a change, or undefined when it is not one. */
export function readFileChange(value: unknown): FileChange | undefined {
  const item = record(value);
  if (typeof item.path !== "string" || typeof item.snapshot !== "string") return undefined;
  return { path: item.path, created: item.created === true, added: count(item.added), removed: count(item.removed), diff: text(item.diff), snapshot: item.snapshot };
}

export function readCommandResult(value: unknown): CommandResult | undefined {
  const item = record(value);
  if (typeof item.stdout !== "string" || typeof item.stderr !== "string") return undefined;
  return {
    exitCode: typeof item.exitCode === "number" ? item.exitCode : null,
    stdout: item.stdout, stderr: item.stderr,
    timedOut: item.timedOut === true, cancelled: item.cancelled === true, truncated: item.truncated === true,
    durationMs: count(item.durationMs),
  };
}

export function readSearchResult(value: unknown): SearchResult | undefined {
  const item = record(value);
  if (!Array.isArray(item.hits)) return undefined;
  const hits = item.hits.map(record).filter((hit) => typeof hit.path === "string")
    .map((hit) => ({ path: hit.path as string, line: count(hit.line), text: text(hit.text) }));
  return { hits, truncated: item.truncated === true };
}
