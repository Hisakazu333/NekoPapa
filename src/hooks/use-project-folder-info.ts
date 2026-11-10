import { useEffect, useState } from "react";
import { checkProjectFolder } from "@/app/projects/project-folder-check";
import type { ProjectFolderCheck } from "@/app/projects/project-folder-info";

/**
 * Live checks of the listed folders, refreshed each time `active` turns on
 * (a menu opening), so a branch switch or a deleted folder shows up. Results
 * are kept per path for the page's lifetime; nothing is stored.
 */
const cache = new Map<string, ProjectFolderCheck>();

export function useProjectFolderInfo(folders: readonly string[], active: boolean) {
  const [, setVersion] = useState(0);
  const key = folders.join("\n");
  useEffect(() => {
    if (!active) return;
    let live = true;
    for (const folder of folders) {
      void checkProjectFolder(folder).then((result) => {
        cache.set(folder, result);
        if (live) setVersion((version) => version + 1);
      });
    }
    return () => { live = false; };
    // `key` stands for the folder list's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);
  return (folder: string) => cache.get(folder);
}
