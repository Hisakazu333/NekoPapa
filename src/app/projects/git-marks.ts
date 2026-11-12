import type { ChangeKind, GitStatus } from "./project-workspace";

/**
 * Git status as the 文件 tree shows it: each changed file carries its kind
 * (M, A, U …), and each folder that holds a change carries a dot. Git lists a
 * wholly untracked folder once as "dir/", so everything under it is untracked.
 */
export interface GitMarks { files: Map<string, ChangeKind>; dirs: Set<string>; untrackedDirs: string[] }

export const NO_MARKS: GitMarks = { files: new Map(), dirs: new Set(), untrackedDirs: [] };

export function gitMarks(status: GitStatus): GitMarks {
  const marks: GitMarks = { files: new Map(), dirs: new Set(), untrackedDirs: [] };
  for (const change of status.changes) {
    const folder = change.path.endsWith("/");
    const path = change.path.replace(/\/+$/, "");
    if (folder) { marks.untrackedDirs.push(path); marks.dirs.add(path); } else marks.files.set(path, change.kind);
    for (let slash = path.lastIndexOf("/"); slash > 0; slash = path.lastIndexOf("/", slash - 1)) marks.dirs.add(path.slice(0, slash));
  }
  return marks;
}

/** The change kind of a file, or of anything inside an untracked folder. */
export function fileMark(marks: GitMarks, path: string): ChangeKind | undefined {
  return marks.files.get(path) ?? (marks.untrackedDirs.some((dir) => path.startsWith(`${dir}/`)) ? "untracked" : undefined);
}

/** Whether a folder holds a change (or is itself untracked, or sits in one). */
export function dirMarked(marks: GitMarks, path: string): boolean {
  return marks.dirs.has(path) || marks.untrackedDirs.some((dir) => path.startsWith(`${dir}/`));
}
