import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { RiAddLine, RiCloseLine, RiGlobalLine } from "@remixicon/react";
import { cx } from "@/utils/cx";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";
import type { ChatTabEntry } from "./chat-workspace-tabs";

/**
 * Open chats as tabs in the empty middle of the title bar, next to the
 * back / forward / new-chat controls (browser-style). Click switches, × or
 * middle-click closes, ←/→ move between tabs and Delete closes the focused
 * one. While a reply is streaming only the active tab is reachable, since a
 * switch would interrupt it. The strip's empty space stays a window drag
 * region in the Tauri host.
 *
 * The built-in browser can live here as its own tab, after the chats. That
 * tab is dragged back to the side by its handle; while the side browser is
 * dragged, the strip is the drop target.
 */
const BROWSER_TAB = "__browser";

export interface BrowserTitleTab {
  title: string;
  active: boolean;
  /** The page is loading: the globe turns into a spinner. */
  loading?: boolean;
  onSelect: () => void;
  onClose: () => void;
  /** Starts a drag; a press that does not move selects the tab. */
  onPointerDown: (event: PointerEvent) => void;
}

export function ChatTitleTabs({ tabs, activeId, busy, nativeWindow, onSelect, onClose, onCreate, browserTab, dropTarget }: {
  tabs: readonly ChatTabEntry[];
  activeId: string;
  busy: boolean;
  nativeWindow: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  /** 新建对话, drawn right after the last tab like a browser's new-tab button. */
  onCreate?: () => void;
  browserTab?: BrowserTitleTab;
  /** The side browser is being dragged: `true` shows the drop target, `"over"` highlights it. */
  dropTarget?: boolean | "over";
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeId)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, tabs.length]);
  const browserActive = browserTab?.active === true;

  const focusTab = (index: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]:not([disabled])");
    if (!buttons?.length) return;
    buttons[(index + buttons.length) % buttons.length].focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]:not([disabled])") ?? [])];
    const index = buttons.indexOf(event.currentTarget);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(index + (event.key === "ArrowRight" ? 1 : -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusTab(event.key === "Home" ? 0 : -1);
    } else if (event.key === "Delete" && !(busy && id === activeId)) {
      event.preventDefault();
      if (id === BROWSER_TAB) browserTab?.onClose();
      else onClose(id);
    }
  };

  return <div data-tauri-drag-region={nativeWindow ? "" : undefined} data-browser-drop="tab" className={cx(
    "flex h-full min-w-4 flex-1 items-center rounded-lg transition-colors",
    dropTarget && "outline-2 -outline-offset-2 outline-dashed",
    dropTarget === "over" ? "bg-background-secondary-hover outline-border-focus-ring" : dropTarget && "outline-border-button-default",
  )}>
    <div ref={listRef} role="tablist" aria-label="打开的对话"
      className="flex min-w-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.id === activeId && !browserActive;
        const locked = busy && tab.id !== activeId;
        return <div key={tab.id} data-tab-id={tab.id} className={cx(
          "group relative flex h-7 w-40 min-w-24 shrink items-center rounded-lg transition-colors",
          active ? "bg-background-secondary-default" : "hover:bg-background-secondary-hover",
        )}>
          <button type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1} disabled={locked}
            aria-keyshortcuts="Delete" title={locked ? `${tab.title}（回复生成中，暂时不能切换）` : tab.title}
            onClick={() => onSelect(tab.id)} onKeyDown={(event) => onKeyDown(event, tab.id)}
            onAuxClick={(event) => { if (event.button === 1 && !(busy && active)) { event.preventDefault(); onClose(tab.id); } }}
            className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-lg ps-2.5 pe-7 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-50">
            {tab.unread && <span aria-label="未读" className="size-1.5 shrink-0 rounded-full bg-accent-500" />}
            <span className={cx("truncate text-body-2-regular", active ? "text-text-primary" : "text-text-secondary")}>{tab.title}</span>
          </button>
          <button type="button" tabIndex={-1} aria-label={`关闭 ${tab.title}`} title="关闭标签" disabled={busy && active}
            onClick={() => onClose(tab.id)}
            className={cx(
              "absolute end-1 flex size-5 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none",
              "hover:bg-background-tertiary-default hover:text-foreground-icon-primary disabled:cursor-not-allowed disabled:opacity-40",
              active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}>
            <RiCloseLine className="size-3.5" aria-hidden />
          </button>
        </div>;
      })}
      {browserTab && <div data-tab-id={BROWSER_TAB} className={cx(
        "group relative flex h-7 w-44 min-w-28 shrink items-center rounded-lg transition-colors",
        browserActive ? "bg-background-secondary-default" : "hover:bg-background-secondary-hover",
      )}>
        <button type="button" role="tab" aria-selected={browserActive} tabIndex={browserActive ? 0 : -1}
          aria-keyshortcuts="Delete" title={`${browserTab.title}（可拖到侧边）`} aria-description="拖到右侧可放回侧边"
          onPointerDown={browserTab.onPointerDown}
          // Pointer presses are handled by the drag; this is the keyboard path.
          onClick={(event) => { if (event.detail === 0) browserTab.onSelect(); }}
          onKeyDown={(event) => onKeyDown(event, BROWSER_TAB)}
          onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); browserTab.onClose(); } }}
          className="flex h-full min-w-0 flex-1 cursor-grab touch-none items-center gap-1.5 rounded-lg ps-2.5 pe-7 text-start outline-none select-none focus-visible:ring-2 focus-visible:ring-border-focus-ring active:cursor-grabbing">
          {browserTab.loading
            ? <SpinnerGlyph size="xs" className="shrink-0 text-foreground-icon-secondary" />
            : <RiGlobalLine className="size-3.5 shrink-0 text-foreground-icon-secondary" aria-hidden />}
          <span className={cx("truncate text-body-2-regular", browserActive ? "text-text-primary" : "text-text-secondary")}>{browserTab.title}</span>
        </button>
        <button type="button" tabIndex={-1} aria-label={`关闭 ${browserTab.title}`} title="关闭浏览器标签" onClick={browserTab.onClose}
          className={cx(
            "absolute end-1 flex size-5 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none",
            "hover:bg-background-tertiary-default hover:text-foreground-icon-primary",
            browserActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}>
          <RiCloseLine className="size-3.5" aria-hidden />
        </button>
      </div>}
    </div>
    {onCreate && <span className="ms-1 flex shrink-0"><ToolbarIconButton icon={RiAddLine} label="新建对话" onPress={onCreate} /></span>}
  </div>;
}
