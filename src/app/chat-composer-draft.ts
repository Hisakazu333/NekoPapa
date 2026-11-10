import { pageElementText, type PageElement } from "./browser-pick";

/** Frontend draft only. Files stay in memory; selecting an output never runs a tool. */
export interface ComposerAttachment {
  id: string;
  name: string;
  path: string;
  size: number;
  modified: number;
  file: File;
}

export type ComposerArtifact = "document" | "spreadsheet" | "presentation" | "code";
export type ComposerMode = "auto" | "chat" | "study" | "agent" | "professional";
export type ComposerContext = "workspace" | "custom" | "official";
export type ComposerPermission = "ask" | "read" | "auto";
export interface ComposerDraft {
  attachments: ComposerAttachment[];
  /** Elements picked in the built-in browser; sent as text with the message. */
  pageElements: PageElement[];
  /** Browser-safe project folder label; the host resolves a real path later. */
  projectDirectory: string;
  goal: string;
  planning: boolean;
  artifact: ComposerArtifact | null;
  mode: ComposerMode;
  permission: ComposerPermission;
}

export const composerModes: { id: ComposerMode; label: string; description: string }[] = [
  { id: "auto", label: "Auto", description: "根据任务选择聊天、学习或 Agent" },
  { id: "chat", label: "聊天", description: "日常交流与休息陪伴" },
  { id: "study", label: "学习", description: "课程、编程与专业知识学习" },
  { id: "agent", label: "Agent", description: "处理通用任务与编程项目" },
  { id: "professional", label: "专业协助", description: "使用自建联系人的专业提示词" },
];
export const composerPermissions: { id: ComposerPermission; label: string; description: string }[] = [
  { id: "ask", label: "每次询问", description: "执行工具操作前先询问" },
  { id: "read", label: "仅查看", description: "只允许读取，禁止修改与执行" },
  { id: "auto", label: "自动", description: "常规操作自动处理，敏感操作仍需确认" },
];

const contextModes: Record<ComposerContext, typeof composerModes> = {
  workspace: composerModes.filter((mode) => mode.id !== "professional"),
  custom: composerModes.filter((mode) => mode.id !== "auto" && mode.id !== "agent"),
  official: composerModes.filter((mode) => mode.id === "chat" || mode.id === "study"),
};

export function composerModesForContext(context: ComposerContext) {
  return contextModes[context];
}

export function modesForWorkspace() {
  return composerModesForContext("workspace");
}

export function modesForContact(official: boolean) {
  return composerModesForContext(official ? "official" : "custom");
}

export const composerArtifacts: { id: ComposerArtifact; label: string; description: string }[] = [
  { id: "document", label: "文档", description: "整理和编写文档" },
  { id: "spreadsheet", label: "电子表格", description: "整理数据和表格" },
  { id: "presentation", label: "演示文稿", description: "准备演示内容" },
  { id: "code", label: "代码块", description: "编写和分析代码" },
];
export const COMPOSER_GOAL_LIMIT = 1000;
export const COMPOSER_FILE_LIMIT = 10;
export const COMPOSER_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const COMPOSER_TOTAL_MAX_BYTES = 25 * 1024 * 1024;

/** `workspaceMode` is General → 新建对话 → 默认模式; contacts always start in chat. */
export function createComposerDraft(context: ComposerContext = "custom", workspaceMode: ComposerMode = "auto"): ComposerDraft {
  const allowed = composerModesForContext(context).some((mode) => mode.id === workspaceMode);
  return { attachments: [], pageElements: [], projectDirectory: "", goal: "", planning: false, artifact: null, mode: context === "workspace" ? (allowed ? workspaceMode : "auto") : "chat", permission: "ask" };
}

export function projectDirectoryFromFiles(files: readonly Pick<File, "webkitRelativePath">[]): string {
  const path = files.find((file) => file.webkitRelativePath)?.webkitRelativePath ?? "";
  return path.split("/")[0] ?? "";
}

export function selectComposerProjectDirectory(
  draft: ComposerDraft,
  files: readonly Pick<File, "webkitRelativePath">[],
): ComposerDraft {
  if (!files.length) return draft;
  const name = projectDirectoryFromFiles(files);
  return name ? { ...draft, projectDirectory: name } : draft;
}

export function clearComposerProjectDirectory(draft: ComposerDraft): ComposerDraft {
  return draft.projectDirectory ? { ...draft, projectDirectory: "" } : draft;
}

export function selectComposerMode(draft: ComposerDraft, mode: ComposerMode): ComposerDraft {
  return { ...draft, mode, projectDirectory: mode === "agent" ? draft.projectDirectory : "" };
}

export function addComposerFiles(current: ComposerAttachment[], files: readonly File[]) {
  const attachments = [...current];
  const errors: string[] = [];
  let total = current.reduce((sum, item) => sum + item.size, 0);
  for (const file of files) {
    const path = file.webkitRelativePath || file.name;
    if (!path || path.startsWith("/") || path.startsWith("\\\\") || /^[a-z]:[\\/]/i.test(path) || path.split(/[\\/]/).some((part) => part === "..")) {
      errors.push("文件路径无效，请重新选择。"); continue;
    }
    if (attachments.some((item) => item.path === path && item.size === file.size && item.modified === file.lastModified)) continue;
    if (attachments.length >= COMPOSER_FILE_LIMIT) { errors.push("每次最多添加 10 个文件。"); break; }
    if (file.size > COMPOSER_FILE_MAX_BYTES) { errors.push(`「${file.name}」超过 10 MB。`); continue; }
    if (total + file.size > COMPOSER_TOTAL_MAX_BYTES) { errors.push("文件总大小不能超过 25 MB。"); continue; }
    attachments.push({ id: crypto.randomUUID(), name: file.name, path, size: file.size, modified: file.lastModified, file });
    total += file.size;
  }
  return { attachments, errors: [...new Set(errors)] };
}

export function validateComposerGoal(value: string) {
  const goal = value.trim();
  return goal.length > COMPOSER_GOAL_LIMIT
    ? { goal: undefined, error: "目标不能超过 1000 个字符。" }
    : { goal, error: undefined };
}

export function composerDraftBlockReason(draft: ComposerDraft): string | undefined {
  if (draft.mode === "auto") return "Auto 模式已选好，等待自动模式路由服务接入。";
  if (draft.mode === "study") return "学习模式已选好，等待学习服务接入。";
  if (draft.mode === "agent") return "Agent 模式已选好，等待通用任务与 Coding 执行服务接入。";
  if (draft.attachments.length) return "文件已选好，附件发送尚未接入。移除附件后可继续文字聊天。";
  if (draft.artifact) return "已选择输出形式，文件生成尚未接入。移除后可继续文字聊天。";
  return undefined;
}

export function buildComposerText(input: string, draft: ComposerDraft): string {
  const parts = [input.trim()];
  if (draft.projectDirectory) parts.push(`项目目录：${draft.projectDirectory}`);
  if (draft.goal) parts.push(`本次目标：${draft.goal}`);
  if (draft.planning) parts.push("请先给出分步计划，说明需要澄清的问题，暂不执行操作。");
  for (const element of draft.pageElements ?? []) parts.push(pageElementText(element));
  return parts.filter(Boolean).join("\n\n");
}
