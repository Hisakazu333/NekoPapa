/**
 * The permission modes for work the Agent / Coding runtime does on the
 * user's machine, after the modes Claude Code and Codex offer. One list for
 * 设置 → 权限规则 (the default for new chats) and the composer's 权限 menu
 * (this chat). In the desktop app a workbench chat in a project sends its
 * mode with each request, and src/app/agent/agent-tools.ts decides from it
 * which project tool calls wait for approval; elsewhere it grants nothing.
 */
export type PermissionMode = "ask" | "acceptEdits" | "plan" | "full";

export const PERMISSION_MODES: readonly { id: PermissionMode; label: string; description: string }[] = [
  { id: "ask", label: "每次询问", description: "读取直接进行；修改文件、运行命令前先询问。" },
  { id: "acceptEdits", label: "自动接受编辑", description: "工作目录内的文件修改直接应用；运行命令仍先询问。" },
  { id: "plan", label: "仅计划", description: "只读取和分析，给出计划；不修改文件、不运行命令。" },
  { id: "full", label: "完全访问", description: "不再询问，直接修改文件和运行命令；只在信任的项目中使用。" },
];

export const DEFAULT_PERMISSION_MODE: PermissionMode = "ask";

export const isPermissionMode = (value: unknown): value is PermissionMode =>
  PERMISSION_MODES.some((mode) => mode.id === value);
