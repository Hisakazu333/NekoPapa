import { isPermissionMode, type PermissionMode } from "../settings/permission-modes";

/**
 * The project a workbench chat works in, as the window sends it with each
 * request: the primary folder of the chat's project, its name and the
 * chat's permission mode. The tools only ever act inside `root`.
 */
export interface AgentWorkspace { root: string; name: string; permission: PermissionMode }

const MAX_ROOT = 1024;
const MAX_NAME = 80;
// An absolute path: /… on macOS and Linux, C:\… or \\server\… on Windows.
const ABSOLUTE = /^(\/|[A-Za-z]:[\\/]|\\\\)/;

export function readAgentWorkspace(value: unknown): AgentWorkspace | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const { root, name, permission } = value as Record<string, unknown>;
  if (typeof root !== "string" || !root || root.length > MAX_ROOT || !ABSOLUTE.test(root) || /[\0\n]/.test(root)) return undefined;
  if (typeof name !== "string" || !name.trim() || name.length > MAX_NAME || !isPermissionMode(permission)) return undefined;
  return { root, name: name.trim(), permission };
}

/** The `workspace` request field for a chat in this project, or nothing outside a project. */
export function agentWorkspaceBody(project: { name: string; folders: readonly string[] } | undefined, permission: PermissionMode): { workspace?: AgentWorkspace } {
  const root = project?.folders[0];
  return root ? { workspace: { root, name: project.name, permission } } : {};
}

/**
 * What the user allowed for the rest of this chat from an approval card:
 * exact commands that no longer ask, and whether file changes no longer ask.
 * Kept by the window for the open chat only (use-agent-run.ts).
 */
export interface AgentAllowances { commands: string[]; edits: boolean }

const MAX_ALLOWED = 100;
const MAX_COMMAND = 4000;

export function readAgentAllowances(value: unknown): AgentAllowances {
  const item = value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
  const commands = Array.isArray(item.commands)
    ? item.commands.filter((command): command is string => typeof command === "string" && command.length > 0 && command.length <= MAX_COMMAND).slice(0, MAX_ALLOWED)
    : [];
  return { commands, edits: item.edits === true };
}
