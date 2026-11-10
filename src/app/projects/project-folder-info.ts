/**
 * Result of checking a project folder on this device. The desktop host
 * (Rust `inspect_project_folder`) and the dev / preview server
 * (`/api/project-folder`) return this same shape. A check only reads the
 * folder's metadata and its Git HEAD; it never lists files or runs commands.
 */

export interface ProjectFolderGit {
  /** Checked-out branch; absent when HEAD is detached. */
  branch?: string;
  /** Short commit id when HEAD is detached. */
  commit?: string;
  /** True for a linked worktree (`git worktree add`). */
  worktree: boolean;
}

export interface ProjectFolderInfo {
  /** Absolute, resolved path: the folder's stable identity. */
  path: string;
  name: string;
  git?: ProjectFolderGit;
}

export type ProjectFolderProblem = "invalid" | "not_found" | "not_directory" | "denied" | "unavailable";

export type ProjectFolderCheck =
  | { ok: true; folder: ProjectFolderInfo }
  | { ok: false; reason: ProjectFolderProblem; message: string };

export const PROJECT_FOLDER_PROBLEMS: Record<ProjectFolderProblem, string> = {
  invalid: "不是完整路径，请输入以 / 或 ~ 开头的路径。",
  not_found: "找不到这个文件夹。",
  not_directory: "这个路径不是文件夹。",
  denied: "没有权限读取这个文件夹。",
  unavailable: "暂时无法检查文件夹。",
};

export function folderProblem(reason: ProjectFolderProblem): ProjectFolderCheck {
  return { ok: false, reason, message: PROJECT_FOLDER_PROBLEMS[reason] };
}

/** Reads `.git/HEAD`: a branch ref, or a detached commit id shortened to 7 characters. */
export function parseGitHead(head: string): { branch?: string; commit?: string } {
  const text = head.trim();
  const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(text);
  if (ref) return { branch: ref[1] };
  if (/^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(text)) return { commit: text.slice(0, 7) };
  return {};
}

const text = (value: unknown, max = 1024) => typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined;

/** Validates a check result from the host or server; anything malformed reads as unavailable. */
export function readProjectFolderCheck(value: unknown): ProjectFolderCheck {
  if (!value || typeof value !== "object") return folderProblem("unavailable");
  const record = value as Record<string, unknown>;
  if (record.ok === false) {
    const reason = record.reason as ProjectFolderProblem;
    return reason in PROJECT_FOLDER_PROBLEMS ? folderProblem(reason) : folderProblem("unavailable");
  }
  const folder = record.folder as Record<string, unknown> | undefined;
  const path = text(folder?.path);
  const name = text(folder?.name, 255);
  if (record.ok !== true || !path || !name) return folderProblem("unavailable");
  const git = folder?.git as Record<string, unknown> | undefined;
  const branch = text(git?.branch, 255);
  const commit = text(git?.commit, 64);
  return {
    ok: true,
    folder: {
      path, name,
      ...(git && typeof git === "object" ? { git: { ...(branch ? { branch } : {}), ...(commit ? { commit } : {}), worktree: git.worktree === true } } : {}),
    },
  };
}
