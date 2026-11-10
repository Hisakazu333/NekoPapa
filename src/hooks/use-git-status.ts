import { useEffect, useState } from "react";
import { parseGitStatus, type GitStatus } from "@/app/project-workspace";
import { projectWorkspace } from "@/app/project-workspace-client";

export type GitState = { kind: "loading" } | { kind: "none" } | { kind: "error"; message: string } | { kind: "ready"; status: GitStatus };

/**
 * `git status` of a project's primary folder, re-read when the window
 * regains focus. Shared by the side panel's 环境 card and the composer's
 * status bar, so both show the same branch and change count.
 */
export function useGitStatus(root: string | undefined): GitState {
  const [git, setGit] = useState<GitState>({ kind: "loading" });
  useEffect(() => {
    if (!root) return;
    let live = true;
    const load = () => projectWorkspace.status(root).then(
      (result) => { if (live) setGit(result.repo ? { kind: "ready", status: parseGitStatus(result.output) } : { kind: "none" }); },
      (error: unknown) => { if (live) setGit({ kind: "error", message: error instanceof Error ? error.message : "读取失败。" }); },
    );
    setGit({ kind: "loading" });
    void load();
    window.addEventListener("focus", load);
    return () => { live = false; window.removeEventListener("focus", load); };
  }, [root]);
  return git;
}

/** The branch as one short label: name, detached, not a repo, or still reading. */
export function gitBranchLabel(git: GitState): string {
  if (git.kind === "ready") return git.status.detached ? "分离的 HEAD" : git.status.branch ?? "—";
  return git.kind === "none" ? "不是 Git 仓库" : git.kind === "error" ? "无法读取" : "读取中…";
}
