import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * Bridge to the desktop host's built-in browser (src-tauri/src/browser_view.rs):
 * one native webview laid over the browser area. Only the Tauri host has it;
 * the web preview cannot embed other sites, so callers check `available`.
 */
export interface BrowserBounds { x: number; y: number; width: number; height: number }
export type BrowserCommand = "back" | "forward" | "reload" | "stop";
export interface BrowserStateEvent { url?: string; title?: string; loading?: boolean }

export const nativeBrowser = {
  available: () => isTauri(),
  open: (url: string, bounds: BrowserBounds) => invoke<void>("browser_open", { url, bounds }),
  setBounds: (bounds: BrowserBounds) => invoke<void>("browser_set_bounds", { bounds }),
  setVisible: (visible: boolean) => invoke<void>("browser_set_visible", { visible }),
  command: (command: BrowserCommand) => invoke<void>("browser_command", { command }),
  close: () => invoke<void>("browser_close"),
  openWindow: (url: string) => invoke<void>("browser_open_window", { url }),
  /** Navigation and title updates from the native view. Returns the unsubscribe. */
  async onState(handler: (state: BrowserStateEvent) => void): Promise<() => void> {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<BrowserStateEvent>("browser://state", (event) => handler(event.payload));
  },
};

export function browserErrorMessage(error: unknown): string {
  const text = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  return text || "浏览器操作失败，请重试。";
}
