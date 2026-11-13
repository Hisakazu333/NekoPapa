/**
 * Read-only views of a project folder for the chat's 文件 and 更改 panels.
 * The desktop host (src-tauri/src/project_workspace.rs) and the browser
 * preview's dev server (scripts/project-workspace-api.ts) list folders, read
 * files and run `git status` / `git diff`; the raw Git output is parsed here,
 * once, for both.
 */

export interface ProjectEntry { name: string; path: string; kind: "dir" | "file" | "link"; size: number }
export interface ProjectListing { entries: ProjectEntry[]; truncated: boolean }
export interface ProjectFile { path: string; size: number; text?: string; binary: boolean; tooLarge: boolean }
export interface GitOutput { repo: boolean; output: string }

export type ChangeKind = "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflicted" | "typechange";
export interface GitChange {
  path: string;
  /** The old path of a rename or copy. */
  from?: string;
  kind: ChangeKind;
  staged: boolean;
  unstaged: boolean;
}
export interface GitStatus { branch?: string; upstream?: string; ahead: number; behind: number; detached: boolean; changes: GitChange[] }

const KIND: Record<string, ChangeKind> = { M: "modified", A: "added", D: "deleted", R: "renamed", C: "added", T: "typechange" };

function changeKind(index: string, worktree: string): ChangeKind {
  if (index === "?" && worktree === "?") return "untracked";
  if (index === "U" || worktree === "U" || (index === "A" && worktree === "A") || (index === "D" && worktree === "D")) return "conflicted";
  if (index === "R" || index === "C") return KIND[index];
  if (index === "A") return "added";
  if (index === "D" || worktree === "D") return "deleted";
  return KIND[worktree !== " " ? worktree : index] ?? "modified";
}

function branchLine(line: string): Omit<GitStatus, "changes"> {
  const text = line.slice(3);
  const info: Omit<GitStatus, "changes"> = { ahead: 0, behind: 0, detached: false };
  if (text.startsWith("HEAD (no branch)")) return { ...info, detached: true };
  const counts = /\[(?:ahead (\d+))?(?:, )?(?:behind (\d+))?\]$/.exec(text);
  const names = (counts ? text.slice(0, counts.index).trim() : text).replace(/^No commits yet on /, "");
  const [branch, upstream] = names.split("...");
  return { ...info, branch: branch || undefined, upstream: upstream || undefined, ahead: Number(counts?.[1] ?? 0), behind: Number(counts?.[2] ?? 0) };
}

/** Parses `git status --porcelain=v1 -z -b`. */
export function parseGitStatus(output: string): GitStatus {
  const fields = output.split("\0");
  let status: GitStatus = { ahead: 0, behind: 0, detached: false, changes: [] };
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    if (!field) continue;
    if (field.startsWith("## ")) { status = { ...branchLine(field), changes: status.changes }; continue; }
    if (field.length < 4 || field[2] !== " ") continue;
    const x = field[0];
    const y = field[1];
    const change: GitChange = { path: field.slice(3), kind: changeKind(x, y), staged: x !== " " && x !== "?", unstaged: y !== " " };
    // Renames and copies carry their old path in the next field.
    if (x === "R" || x === "C") change.from = fields[++index];
    status.changes.push(change);
  }
  return status;
}

export type DiffLine =
  | { kind: "meta"; text: string }
  | { kind: "hunk"; text: string }
  | { kind: "add" | "del" | "ctx"; text: string; old?: number; new?: number };

export interface FileDiff { lines: DiffLine[]; added: number; removed: number; binary: boolean }

/** Parses one file's unified diff into numbered lines. */
export function parseUnifiedDiff(text: string): FileDiff {
  const result: FileDiff = { lines: [], added: 0, removed: 0, binary: false };
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;
  for (const line of text.split("\n")) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      inHunk = true;
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      result.lines.push({ kind: "hunk", text: line });
    } else if (!inHunk) {
      if (/^Binary files .* differ$/.test(line)) result.binary = true;
    } else if (line.startsWith("+")) {
      result.added++;
      result.lines.push({ kind: "add", text: line.slice(1), new: newLine++ });
    } else if (line.startsWith("-")) {
      result.removed++;
      result.lines.push({ kind: "del", text: line.slice(1), old: oldLine++ });
    } else if (line.startsWith(" ")) {
      result.lines.push({ kind: "ctx", text: line.slice(1), old: oldLine++, new: newLine++ });
    } else if (line.startsWith("\\")) {
      result.lines.push({ kind: "meta", text: line });
    } else if (line.startsWith("diff --git")) {
      inHunk = false;
    }
  }
  return result;
}

/** A new file shown as all added lines. */
export function untrackedDiff(text: string): FileDiff {
  const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
  return { lines: lines.map((line, index) => ({ kind: "add", text: line, new: index + 1 })), added: lines.length, removed: 0, binary: false };
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Host replies are checked before use, whichever host sent them. */
export function readListing(value: unknown): ProjectListing {
  if (!isObject(value) || !Array.isArray(value.entries)) throw new Error("文件列表格式无效。");
  const entries = value.entries.flatMap((entry): ProjectEntry[] => {
    if (!isObject(entry) || typeof entry.name !== "string" || typeof entry.path !== "string") return [];
    const kind = entry.kind === "dir" || entry.kind === "link" ? entry.kind : "file";
    return [{ name: entry.name, path: entry.path, kind, size: typeof entry.size === "number" ? entry.size : 0 }];
  });
  return { entries, truncated: value.truncated === true };
}

/** Every file of a project, relative to its root with `/`. */
export interface FileIndex { paths: string[]; truncated: boolean }

export function readFileIndex(value: unknown): FileIndex {
  if (!isObject(value) || !Array.isArray(value.paths)) throw new Error("文件索引格式无效。");
  return { paths: value.paths.filter((path): path is string => typeof path === "string" && path.length > 0), truncated: value.truncated === true };
}

export function readProjectFile(value: unknown): ProjectFile {
  if (!isObject(value) || typeof value.path !== "string") throw new Error("文件内容格式无效。");
  return {
    path: value.path, size: typeof value.size === "number" ? value.size : 0,
    ...(typeof value.text === "string" ? { text: value.text } : {}),
    binary: value.binary === true, tooLarge: value.tooLarge === true,
  };
}

export function readGitOutput(value: unknown): GitOutput {
  if (!isObject(value) || typeof value.repo !== "boolean" || typeof value.output !== "string") throw new Error("Git 输出格式无效。");
  return { repo: value.repo, output: value.output };
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
