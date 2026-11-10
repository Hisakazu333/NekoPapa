import { isTauri } from "@tauri-apps/api/core";

/**
 * The system folder picker, available in the desktop app only. A browser
 * page cannot learn a folder's full path, so the preview falls back to typing
 * the path; it never reads the folder's files.
 */
export function canPickFolder() {
  return isTauri();
}

/** Full path of the folder chosen in the system picker, or null when cancelled. */
export async function pickProjectFolder(defaultPath?: string): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const chosen = await open({ directory: true, multiple: false, title: "选择项目文件夹", ...(defaultPath ? { defaultPath } : {}) });
  return typeof chosen === "string" && chosen ? chosen : null;
}

export function folderPickerError(error: unknown) {
  return error instanceof Error && error.message ? error.message : "系统文件夹窗口没有打开。";
}
