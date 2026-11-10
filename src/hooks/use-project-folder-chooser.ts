import { useState } from "react";
import { canPickFolder, folderPickerError, pickProjectFolder } from "@/app/projects/native-folder-picker";
import { checkProjectFolder } from "@/app/projects/project-folder-check";

export interface ChosenFolder { folder?: string; error?: string }

/**
 * Chooses a folder the way desktop coding tools do: the system folder picker
 * (desktop) or a typed path (browser preview), checked on this device first.
 * Only an existing folder comes back, as its resolved full path; callers
 * decide whether it starts a project or joins one.
 */
export function useProjectFolderChooser() {
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);

  const check = async (path: string): Promise<ChosenFolder> => {
    const result = await checkProjectFolder(path);
    return result.ok ? { folder: result.folder.path } : { error: result.message };
  };

  /** Neither field when the picker was cancelled. */
  const pick = async (): Promise<ChosenFolder> => {
    setError("");
    setPicking(true);
    try {
      const chosen = await pickProjectFolder();
      const result = chosen ? await check(chosen) : {};
      if (result.error) setError(result.error);
      return result;
    } catch (cause) {
      const message = `无法打开系统文件夹窗口：${folderPickerError(cause)}`;
      setError(message);
      return { error: message };
    } finally {
      setPicking(false);
    }
  };

  return { desktop: canPickFolder(), pick, check, picking, error, setError, clearError: () => setError("") };
}
