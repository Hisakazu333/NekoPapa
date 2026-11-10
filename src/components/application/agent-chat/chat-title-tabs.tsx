import { useEffect, useRef, type KeyboardEvent } from "react";
import { RiCloseLine } from "@remixicon/react";
import { cx } from "@/utils/cx";
import type { ChatTabEntry } from "./chat-workspace-tabs";

/**
 * Open chats as tabs in the empty middle of the title bar, next to the
 * back / forward / new-chat controls (browser-style). Click switches, × or
 * middle-click closes, ←/→ move between tabs and Delete closes the focused
 * one. While a reply is streaming only the active tab is reachable, since a
 * switch would interrupt it. The strip's empty space stays a window drag
 * region in the Tauri host.
 */
export function ChatTitleTabs({ tabs, activeId, busy, nativeWindow, onSelect, onClose }: {
  tabs: readonly ChatTabEntry[];
  activeId: string;
  busy: boolean;
  nativeWindow: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeId)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, tabs.length]);

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
      onClose(id);
    }
  };

  return <div data-tauri-drag-region={nativeWindow ? "" : undefined} className="flex h-full min-w-4 flex-1 items-center">
    <div ref={listRef} role="tablist" aria-label="打开的对话"
      className="flex min-w-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const locked = busy && !active;
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
    </div>
  </div>;
}
