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
