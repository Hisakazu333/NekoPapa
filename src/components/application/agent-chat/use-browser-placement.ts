import { useCallback, useState } from "react";
import type { ChatTool } from "@/app/chat/chat-tools";
import type { PluginViewId } from "@/app/plugins/slot-registry";

type ChatAuxiliary = "panel" | "browser" | null;
/** Built-in views, the tools, or an enabled interface plugin's view. */
export type WorkPanelView = "history" | "code" | "study" | ChatTool | PluginViewId;

/**
 * Where the built-in browser lives: in the right-hand area beside the chat
 * (`auxiliary === "browser"`), or as its own tab in the title bar that shows
 * the page across the whole work area. There is one browser either way, so
 * moving it keeps the page. The browser and the work panel share one
 * right-hand area. The work panel remembers its view when hidden.
 *
 * `chatId` is the open chat: opening another chat (from a tab, the sidebar
 * or 新建对话) leaves the browser tab for the chat, which keeps the tab.
 */
export function useBrowserPlacement(chatId: string) {
  const [auxiliary, setAuxiliary] = useState<ChatAuxiliary>(null);
  // The pane the right-hand area opens to without a choice (dragging it open): 环境与上下文.
  const [panelView, setPanelView] = useState<WorkPanelView>("code");
  // null: no browser tab. `active`: the tab is the one shown.
  const [browserTab, setBrowserTab] = useState<{ active: boolean } | null>(null);
  const [shownChat, setShownChat] = useState(chatId);
  if (shownChat !== chatId) {
    setShownChat(chatId);
    if (browserTab?.active) setBrowserTab({ active: false });
  }

  const openWorkPanel = useCallback((view?: WorkPanelView) => {
    setBrowserTab((current) => current?.active ? { active: false } : current);
    if (view) setPanelView(view);
    setAuxiliary("panel");
  }, []);
  const toggleWorkPanel = useCallback(() => {
    if (browserTab?.active) openWorkPanel();
    else setAuxiliary((current) => current === "panel" ? null : "panel");
  }, [browserTab?.active, openWorkPanel]);
  const closeAuxiliary = useCallback(() => setAuxiliary(null), []);
  const panelShown = auxiliary === "panel" && !browserTab?.active;
  /** A title-bar pane button or its shortcut: opens that pane, or closes it when it is the one shown. */
  const togglePanelView = useCallback((view: WorkPanelView) => {
    if (panelShown && panelView === view) setAuxiliary(null);
    else openWorkPanel(view);
  }, [panelShown, panelView, openWorkPanel]);

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
    else setAuxiliary((current) => current === "browser" ? null : "browser");
  }, [browserTab]);
  const selectBrowserTab = useCallback(() => setBrowserTab({ active: true }), []);
  /** Shows the browser wherever it lives (a chat link opening in it). */
  const showBrowser = useCallback(() => {
    if (browserTab) setBrowserTab({ active: true });
    else setAuxiliary("browser");
  }, [browserTab]);
  /** A chat tab or a new chat was chosen: the browser tab stays, in the background. */
  const leaveBrowserTab = useCallback(() => setBrowserTab((current) => current && { active: false }), []);
  const closeBrowserTab = useCallback(() => setBrowserTab(null), []);

  return {
    auxiliary,
    browserTab,
    browserTabActive: browserTab?.active === true,
    /** The browser is on screen, in either place. */
    browserShown: auxiliary === "browser" || browserTab?.active === true,
    panelView,
    /** The pane on screen in the right-hand area or the browser tab, if any. */
    shownPane: browserTab?.active || auxiliary === "browser" ? "browser" as const : panelShown ? panelView : null,
    openWorkPanel,
    togglePanelView,
    toggleWorkPanel,
    closeAuxiliary,
    toggleBrowser,
    moveToTab,
    moveToSide,
    selectBrowserTab,
    showBrowser,
    leaveBrowserTab,
    closeBrowserTab,
  };
}

export type BrowserPlacement = ReturnType<typeof useBrowserPlacement>;
