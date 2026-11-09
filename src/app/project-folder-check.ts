import { invoke, isTauri } from "@tauri-apps/api/core";
import { folderProblem, readProjectFolderCheck, type ProjectFolderCheck } from "./project-folder-info";

/**
 * Checks a folder on this device: the desktop host answers through
 * `inspect_project_folder`; the browser preview asks the local dev / preview
 * server. When neither answers, the folder reads as unavailable, never as valid.
 */
export async function checkProjectFolder(path: string): Promise<ProjectFolderCheck> {
  try {
    if (isTauri()) return readProjectFolderCheck(await invoke("inspect_project_folder", { path }));
    const response = await fetch("/api/project-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    return response.ok ? readProjectFolderCheck(await response.json()) : folderProblem("unavailable");
  } catch {
    return folderProblem("unavailable");
  }
}
