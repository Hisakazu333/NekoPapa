import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * Opens an http(s) address in the system browser: through the desktop host
 * in the app, or a new tab in the browser preview. Rejects with a message
 * ready to show.
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    try { await invoke("open_external_url", { url }); } catch (error) { throw new Error(typeof error === "string" ? error : "无法打开系统浏览器。"); }
    return;
  }
  // With noopener the browser returns null even on success, so there is nothing to check.
  window.open(url, "_blank", "noopener,noreferrer");
}

/** GitHub repository search for DeepSeek Harness plugins; GitHub ranks the results. */
export const DSH_PLUGIN_SEARCH_URL = `https://github.com/search?q=${encodeURIComponent("deepseek-harness plugin")}&type=repositories`;
