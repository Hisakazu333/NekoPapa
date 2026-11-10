import { useCallback, useState } from "react";
import type { ChatTool } from "@/app/chat-tools";

/** What the right-hand area shows: the side panel, the side browser or a title-bar tool. */
export type ChatAuxiliary = "panel" | "browser" | ChatTool | null;

/**
 * Where the built-in browser lives: in the right-hand area beside the chat
 * (`auxiliary === "browser"`), or as its own tab in the title bar that shows
 * the page across the whole work area. There is one browser either way, so
 * moving it keeps the page. The side panel (历史 / 代码 / 资料), the side
 * browser and the title-bar tools (目录 / 终端 / 更改 / 文件) take turns in
 * the right-hand area.
 *
 * `chatId` is the open chat: opening another chat (from a tab, the sidebar
 * or 新建对话) leaves the browser tab for the chat, which keeps the tab.
 */
export function useBrowserPlacement(chatId: string) {
  const [auxiliary, setAuxiliary] = useState<ChatAuxiliary>(null);
  // null: no browser tab. `active`: the tab is the one shown.
  const [browserTab, setBrowserTab] = useState<{ active: boolean } | null>(null);
  const [shownChat, setShownChat] = useState(chatId);
  if (shownChat !== chatId) {
    setShownChat(chatId);
    if (browserTab?.active) setBrowserTab({ active: false });
  }

  const toggleAuxiliary = useCallback((kind: Exclude<ChatAuxiliary, null>) => {
    // The side area belongs to the chat view, so using it shows the chat.
    setBrowserTab((current) => current && { active: false });
    setAuxiliary((current) => current === kind ? null : kind);
  }, []);
  const openSidePanel = useCallback(() => {
    setBrowserTab((current) => current && { active: false });
    setAuxiliary("panel");
  }, []);
  const closeAuxiliary = useCallback(() => setAuxiliary(null), []);

  const moveToTab = useCallback(() => {
    setAuxiliary((current) => current === "browser" ? null : current);
    setBrowserTab({ active: true });
  }, []);
  const moveToSide = useCallback(() => {
    setBrowserTab(null);
    setAuxiliary("browser");
  }, []);
  /** The title-bar 浏览器 button: shows the browser wherever it lives, or hides it. */
  const toggleBrowser = useCallback(() => {
    if (browserTab) setBrowserTab({ active: !browserTab.active });
    else toggleAuxiliary("browser");
  }, [browserTab, toggleAuxiliary]);
  const selectBrowserTab = useCallback(() => setBrowserTab({ active: true }), []);
  /** A chat tab or a new chat was chosen: the browser tab stays, in the background. */
  const leaveBrowserTab = useCallback(() => setBrowserTab((current) => current && { active: false }), []);
  const closeBrowserTab = useCallback(() => setBrowserTab(null), []);

  return {
    auxiliary,
    browserTab,
    browserTabActive: browserTab?.active === true,
    /** The browser is on screen, in either place. */
    browserShown: auxiliary === "browser" || browserTab?.active === true,
    toggleAuxiliary,
    openSidePanel,
    closeAuxiliary,
    toggleBrowser,
    moveToTab,
    moveToSide,
    selectBrowserTab,
    leaveBrowserTab,
    closeBrowserTab,
  };
}

export type BrowserPlacement = ReturnType<typeof useBrowserPlacement>;
