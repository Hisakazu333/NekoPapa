import { RiGitBranchLine } from "@remixicon/react";
import type { ProjectFolderCheck } from "@/app/project-folder-info";
import { cx } from "@/utils/cx";

/**
 * Second line of a folder row, from a live check: its Git branch (or the
 * detached commit, and "工作树" for a linked worktree), why it is unavailable,
 * or its path while the check is pending or when it is not in Git.
 */
export function ProjectFolderDetail({ folder, info, className }: { folder: string; info?: ProjectFolderCheck; className?: string }) {
  const detail = cx("truncate text-caption-1-regular", className);
  if (info && !info.ok) {
    return <span className={cx(detail, info.reason === "unavailable" ? "text-text-tertiary" : "text-text-error-primary")}>{info.message}</span>;
  }
  const git = info?.ok ? info.folder.git : undefined;
  const head = git?.branch ?? (git?.commit ? `分离于 ${git.commit}` : undefined);
  if (head) {
    return <span className={cx(detail, "flex min-w-0 items-center gap-1 text-text-tertiary")} title={folder}>
      <RiGitBranchLine className="size-3.5 shrink-0" aria-label="Git 分支" />
      <span translate="no" className="truncate">{head}</span>
      {git?.worktree && <span className="shrink-0">· 工作树</span>}
    </span>;
  }
  return <span translate="no" className={cx(detail, "text-text-tertiary")}>{folder}</span>;
}
