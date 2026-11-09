import { RiChat3Line } from "@remixicon/react";
import { useState, type KeyboardEvent } from "react";
import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import type { StoredThread } from "@/components/application/agent-chat/thread-storage";
import { messageText } from "@/components/application/agent-chat/thread-storage";
import { recentAge } from "./sidebar-recent-groups";
import { RecentRowMenu } from "./recent-row-menu";
import { Collapsible } from "./sidebar-navigation";
import { cx } from "@/utils/cx";

/** Shared by every recent-chat row in the sidebar, grouped or not. */
export interface RowActions {
  activeId: string;
  busy: boolean;
  collapsed: boolean;
  now: number;
  onSelect: (thread: StoredThread) => void;
  onRename: (id: string, title: string) => void;
  onToggleUnread: (id: string) => void;
  onDelete: (thread: StoredThread) => void;
}

/** One recent chat: single-line title with an age badge; nested rows sit in a project folder's tree. */
export function RecentConversationRow({ thread, actions, nested = false }: { thread: StoredThread; actions: RowActions; nested?: boolean }) {
  const localize = useTemplateCopy();
  const { activeId, busy, collapsed, now, onSelect, onRename, onToggleUnread, onDelete } = actions;
  const active = thread.id === activeId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(thread.title);
  const disabled = busy && !active;
  const preview = [...thread.messages].reverse().map(messageText).find((text) => text.trim()) ?? "";
  const title = thread.title === "New chat" ? "新对话" : thread.title;
  const updated = new Date(thread.updatedAt);
  const readableDate = Number.isFinite(updated.getTime()) ? updated.toISOString() : undefined;

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== thread.title) onRename(thread.id, next);
    setRenaming(false);
  };
  const onRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(thread.title);
      setRenaming(false);
    }
  };

  if (renaming) {
    return localize(<div className="rounded-2lg bg-background-secondary-hover px-2 py-1.5">
      <label className="sr-only" htmlFor={`recent-rename-${thread.id}`}>重命名对话</label>
      <input id={`recent-rename-${thread.id}`} autoFocus value={draft} onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onRenameKeyDown} onBlur={commitRename}
        className="w-full bg-transparent text-body-2-regular text-text-primary outline-none" />
    </div>);
  }

  return localize(<div className={cx(
    "group/recent relative flex min-w-0 items-center rounded-2lg transition-colors",
    active || menuOpen ? "bg-background-secondary-hover" : "hover:bg-background-secondary-hover/60",
  )}>
    <button type="button" onClick={() => onSelect(thread)} disabled={disabled}
      aria-label={`打开对话：${title}`} aria-current={active ? "true" : undefined}
      title={`${title}${preview ? ` · ${preview}` : ""}`}
      className={cx(
        "flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-50",
        nested ? "px-2 py-1.5" : "p-2",
        collapsed ? "w-9 justify-center" : "w-full",
      )}>
      {!nested && <span className="relative flex size-5 shrink-0 items-center justify-center">
        <RiChat3Line className="size-4 text-foreground-icon-secondary" aria-hidden />
        {thread.unread && <span className="absolute -end-0.5 -top-0.5 size-1.5 rounded-full bg-accent-600" aria-label="未读" />}
      </span>}
      <Collapsible collapsed={collapsed} className="flex-1 gap-2 pe-1">
        {nested && thread.unread && <span className="size-1.5 shrink-0 rounded-full bg-accent-600" aria-label="未读" />}
        <span translate={thread.title === "New chat" ? undefined : "no"} className={cx(
          "min-w-0 flex-1 truncate text-body-2-medium", active ? "text-text-primary" : "text-text-secondary",
        )}>{title}</span>
        <time dateTime={readableDate} className={cx(
          "shrink-0 rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-caption-1-medium text-text-tertiary transition-opacity",
          "group-hover/recent:opacity-0 group-focus-within/recent:opacity-0", menuOpen && "opacity-0",
        )}>{recentAge(thread.updatedAt, now)}</time>
      </Collapsible>
    </button>
    {!collapsed && <RecentRowMenu thread={thread} isOpen={menuOpen} onOpenChange={setMenuOpen}
      onRename={() => { setDraft(thread.title); setRenaming(true); }}
      onToggleUnread={() => onToggleUnread(thread.id)}
      deleteDisabled={busy && active}
      onDelete={() => onDelete(thread)} />}
  </div>);
}
