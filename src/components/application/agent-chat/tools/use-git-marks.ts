import { useCallback, useEffect, useState } from "react";
import { ANY_PROJECT, onProjectChange } from "@/app/agent/project-change-events";
import { gitMarks, NO_MARKS, type GitMarks } from "@/app/projects/git-marks";
import { parseGitStatus } from "@/app/projects/project-workspace";
import { projectWorkspace } from "@/app/projects/project-workspace-client";

/**
 * The Git status of `root` for the 文件 tree, read on open, on `refresh`,
 * when the window regains focus and after each Agent change. A folder that
 * is not a repository, or a failed read, just shows no marks.
 */
export function useGitMarks(root: string): { marks: GitMarks; refresh: () => void } {
  const [marks, setMarks] = useState<GitMarks>(NO_MARKS);
  const refresh = useCallback(() => {
    void projectWorkspace.status(root).then(
      (result) => setMarks(result.repo ? gitMarks(parseGitStatus(result.output)) : NO_MARKS),
      () => setMarks(NO_MARKS),
    );
  }, [root]);
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    const stop = onProjectChange((changed) => { if (changed === root || changed === ANY_PROJECT) refresh(); });
    return () => { window.removeEventListener("focus", refresh); stop(); };
  }, [refresh, root]);
  return { marks, refresh };
}
