import {
  RiChat3Line, RiDeleteBinLine, RiMailCheckLine, RiMailUnreadLine,
  RiMore2Fill, RiPencilLine,
} from "@remixicon/react";
import { useState, type KeyboardEvent } from "react";
import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import { useApplicationLanguage } from "@/components/application/language/application-language";
import { AlertDialog } from "@/components/base/modal/modal";
import {
  Dropdown, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger,
} from "@/components/base/dropdown/dropdown";
import type { StoredThread } from "@/components/application/agent-chat/thread-storage";
import { messageText } from "@/components/application/agent-chat/thread-storage";
import { recentSidebarThreads } from "./sidebar-search";
import { Collapsible } from "./sidebar-navigation";
import { cx } from "@/utils/cx";

export function DashboardRecentConversations({
  threads, collapsed, activeId, busy, onSelect, onShowAll, onRename, onToggleUnread, onDelete,
}: {
  threads: StoredThread[];
  collapsed: boolean;
  activeId: string;
  busy: boolean;
  onSelect: (thread: StoredThread) => void;
  onShowAll: () => void;
  onRename: (id: string, title: string) => void;
  onToggleUnread: (id: string) => void;
  onDelete: (id: string) => boolean | Promise<boolean>;
}) {
  const localize = useTemplateCopy();
  const { language } = useApplicationLanguage();
  const recent = recentSidebarThreads(threads);
  const workspaceCount = threads.filter((thread) => !thread.contact && thread.messages.length > 0).length;
  const [deleteTarget, setDeleteTarget] = useState<StoredThread | null>(null);
  const [deleteError, setDeleteError] = useState<string>();
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const deleted = await onDelete(deleteTarget.id);
    if (!deleted) {
      setDeleteError("无法保存删除操作。对话仍保留在本机，请检查存储后重试。");
      throw new Error("Chat history deletion was not persisted");
    }
  };

  return localize(<section aria-label="最近对话" className="flex min-w-0 flex-col gap-1">
    <Collapsible collapsed={collapsed} className="px-2">
      <span className="py-1 text-body-2-medium text-text-tertiary">最近对话</span>
    </Collapsible>
    {recent.map((thread) => <RecentConversationRow
      key={thread.id}
      thread={thread}
      active={thread.id === activeId}
      busy={busy}
      collapsed={collapsed}
      language={language}
      onSelect={onSelect}
      onRename={onRename}
      onToggleUnread={onToggleUnread}
      deleteDisabled={busy && thread.id === activeId}
      onDelete={() => { setDeleteError(undefined); setDeleteTarget(thread); }}
    />)}
    {recent.length === 0 && !collapsed && <p className="px-2 py-1 text-body-2-regular text-text-tertiary">聊天后会显示在这里</p>}
    {workspaceCount > recent.length && !collapsed && <button type="button" onClick={onShowAll}
      className="w-full cursor-pointer rounded-2lg px-2 py-1 text-start text-body-2-medium text-text-secondary hover:bg-background-secondary-hover">查看全部对话</button>}
    <AlertDialog
      isOpen={deleteTarget !== null}
      onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteError(undefined); } }}
      title="删除这段对话？"
      description={deleteTarget ? `“${deleteTarget.title}”及其消息记录将从本机移除。此操作无法撤销。` : undefined}
      confirmLabel="删除对话"
      cancelLabel="取消"
      pendingLabel="正在删除…"
      onConfirm={confirmDelete}
      onCancel={() => setDeleteError(undefined)}
    >
      {deleteError && <p role="alert" className="text-body-2-regular text-text-error-primary">{deleteError}</p>}
    </AlertDialog>
  </section>);
}

function RecentConversationRow({
  thread, active, busy, collapsed, language, onSelect, onRename, onToggleUnread, deleteDisabled, onDelete,
}: {
  thread: StoredThread;
  active: boolean;
  busy: boolean;
  collapsed: boolean;
  language: "zh-CN" | "en-US";
  onSelect: (thread: StoredThread) => void;
  onRename: (id: string, title: string) => void;
  onToggleUnread: (id: string) => void;
  deleteDisabled: boolean;
  onDelete: () => void;
}) {
  const localize = useTemplateCopy();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(thread.title);
  const disabled = busy && !active;
  const preview = [...thread.messages].reverse().map(messageText).find((text) => text.trim()) ?? "";
  const title = thread.title === "New chat" ? "新对话" : thread.title;
  const updated = new Date(thread.updatedAt);
  const time = recentTime(thread.updatedAt, language);
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
      <input
        id={`recent-rename-${thread.id}`}
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onRenameKeyDown}
        onBlur={commitRename}
        className="w-full bg-transparent text-body-2-regular text-text-primary outline-none"
      />
    </div>);
  }

  return localize(<div className={cx(
    "group/recent relative flex min-w-0 items-center rounded-2lg transition-colors",
    active || menuOpen ? "bg-background-secondary-hover" : "hover:bg-background-secondary-hover/60",
  )}>
    <button type="button" onClick={() => onSelect(thread)} disabled={disabled}
      aria-label={`打开对话：${title}`} aria-current={active ? "true" : undefined}
      title={collapsed ? `${title}${preview ? ` · ${preview}` : ""}` : undefined}
      className={cx(
        "flex min-w-0 flex-1 cursor-pointer items-center gap-2 p-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-50",
        collapsed ? "w-9 justify-center" : "w-full",
      )}>
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        <RiChat3Line className="size-4 text-foreground-icon-secondary" aria-hidden />
        {thread.unread && <span className="absolute -end-0.5 -top-0.5 size-1.5 rounded-full bg-accent-600" aria-label="未读" />}
      </span>
      <Collapsible collapsed={collapsed} className="flex-1 flex-col items-start">
        <span className="flex w-full min-w-0 items-center justify-between gap-2">
          <span translate={thread.title === "New chat" ? undefined : "no"} className="min-w-0 flex-1 truncate text-body-2-medium text-text-secondary">{title}</span>
          <time dateTime={readableDate} className="shrink-0 text-caption-1-regular text-text-tertiary">{time}</time>
        </span>
        <span translate="no" className="w-full truncate text-caption-regular text-text-tertiary">{preview}</span>
      </Collapsible>
    </button>
    <RowMenu
      thread={thread}
      isOpen={menuOpen}
      onOpenChange={setMenuOpen}
      onRename={() => { setDraft(thread.title); setRenaming(true); }}
      onToggleUnread={() => onToggleUnread(thread.id)}
      deleteDisabled={deleteDisabled}
      onDelete={onDelete}
    />
  </div>);
}

function RowMenu({ thread, isOpen, onOpenChange, onRename, onToggleUnread, deleteDisabled, onDelete }: {
  thread: StoredThread;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onToggleUnread: () => void;
  deleteDisabled: boolean;
  onDelete: () => void;
}) {
  const localize = useTemplateCopy();
  const choose = (action: () => void) => () => { onOpenChange(false); action(); };
  const label = thread.unread ? "标为已读" : "标为未读";
  const ReadIcon = thread.unread ? RiMailCheckLine : RiMailUnreadLine;

  return localize(<Dropdown isOpen={isOpen} onOpenChange={onOpenChange}>
    <DropdownTrigger
      aria-label={`更多操作：${thread.title}`}
      className={cx(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-foreground-icon-secondary transition-colors duration-150 ease",
        "opacity-0 hover:bg-background-tertiary-default hover:text-foreground-icon-primary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border-focus-ring group-hover/recent:opacity-100 group-focus-within/recent:opacity-100",
        isOpen && "bg-background-tertiary-default text-foreground-icon-primary opacity-100",
      )}
    >
      <RiMore2Fill className="size-4" aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label={`更多操作：${thread.title}`} placement="bottom end" className="w-[190px] p-2">
      <DropdownGroup>
        <DropdownItem onSelect={choose(onRename)} className="px-2 py-1.5">
          <RiPencilLine className="size-4 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-medium text-text-primary">重命名</span>
        </DropdownItem>
        <DropdownItem onSelect={choose(onToggleUnread)} className="px-2 py-1.5">
          <ReadIcon className="size-4 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-medium text-text-primary">{label}</span>
        </DropdownItem>
        <DropdownItem disabled={deleteDisabled} onSelect={choose(onDelete)} className="px-2 py-1.5">
          <RiDeleteBinLine className="size-4 text-text-error-primary" aria-hidden />
          <span className="text-body-medium text-text-error-primary">删除对话</span>
        </DropdownItem>
      </DropdownGroup>
    </DropdownPopover>
  </Dropdown>);
}

function recentTime(timestamp: number, language: "zh-CN" | "en-US") {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString(language, { month: "numeric", day: "numeric" });
}
