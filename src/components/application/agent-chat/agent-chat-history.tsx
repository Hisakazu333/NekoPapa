"use client";

import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";

import { DownloadIcon, EllipsisVerticalIcon, PlusIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownPopover,
  DropdownTrigger,
} from "@/components/base/dropdown/dropdown";
import { cx } from "@/utils/cx";

/**
 * The chat-history rail, a card of its own beside the chat.
 *
 * It mirrors the structure of the app sidebar — an action at the top, a
 * section label, then a list of items with a relative-time badge — so the two
 * rails read as the same system from opposite sides of the workspace.
 *
 * Threads are held by the parent and kept in the visitor's own browser. That
 * is the honest ceiling for a starter with no database: hosted history across
 * devices is what a backend buys you, and this is the free version of it.
 */

export interface ChatThreadSummary {
  id: string;
  title: string;
  updatedAt: number;
  unread?: boolean;
}

export interface AgentChatHistoryProps {
  threads: ChatThreadSummary[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onToggleUnread: (id: string) => void;
  onDelete: (id: string) => void;
  /** Downloads the stored chats as JSON. */
  onExport: () => void;
  /** Disables switching mid-stream, which would strand the running response. */
  disabled?: boolean;
  className?: string;
  onClose?: () => void;
}

export function AgentChatHistory({
  threads,
  activeId,
  onSelect,
  onNewChat,
  onRename,
  onToggleUnread,
  onDelete,
  onExport,
  disabled = false,
  className,
  onClose,
}: AgentChatHistoryProps) {
  const localize = useTemplateCopy();
  return localize((
    <aside
      aria-label="对话历史"
      className={cx(
        // A card of its own beside the chat rather than a panel within it, the
        // way the Pro template seats its code panel: same surface and radius as
        // the chat card, separated by the workspace gap. Full height, and its
        // own padding, since it no longer borrows the chat card's.
        "flex h-full w-[260px] shrink-0 flex-col gap-6 overflow-hidden rounded-2xl border border-separator-border bg-background-primary-default p-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onNewChat}
        disabled={disabled}
        className="flex w-full cursor-pointer items-center gap-2 rounded-2lg px-2 py-2 text-body-medium text-text-primary transition-colors hover:bg-background-secondary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PlusIcon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
        新对话
      </button>
      {onClose && <button type="button" onClick={onClose} aria-label="关闭辅助工作区" className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary hover:bg-background-secondary-hover"><XIcon className="size-5" aria-hidden /></button>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:none]">
        <p className="px-2 pb-1 text-body-2-medium text-text-tertiary">最近</p>

        {threads.length === 0 ? (
          <p className="px-2 text-body-2-regular text-text-tertiary">
            聊天后会显示在这里。
          </p>
        ) : (
          threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              active={thread.id === activeId}
              disabled={disabled}
              onSelect={onSelect}
              onRename={onRename}
              onToggleUnread={onToggleUnread}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      <RailFooter threads={threads} onExport={onExport} />
    </aside>
  ));
}

/** Local storage identity and export, with no account or service claims. */
function RailFooter({
  threads,
  onExport,
}: {
  threads: ChatThreadSummary[];
  onExport: () => void;
}) {
  const localize = useTemplateCopy();
  const count = threads.length;
  const label = count === 0 ? "没有可导出的对话" : `导出 ${count} 段对话`;
  return localize((
    <div className="mt-auto flex items-center gap-1 border-t border-separator-border pt-3 pe-1">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2lg px-1 py-1">
        <img
          src="/brand/nekopapa-app-icon-v1-128.png"
          alt=""
          className="size-6 shrink-0 rounded-full object-contain"
        />
        <span className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">本机对话</span>
      </div>
      <button
        type="button"
        onClick={onExport}
        disabled={count === 0}
        aria-label={label}
        title={label}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-button-primary text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <DownloadIcon className="size-3.5 shrink-0" aria-hidden />
      </button>
    </div>
  ));
}

function ThreadRow({
  thread,
  active,
  disabled,
  onSelect,
  onRename,
  onToggleUnread,
  onDelete,
}: {
  thread: ChatThreadSummary;
  active: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onToggleUnread: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const localize = useTemplateCopy();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(thread.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [renaming]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== thread.title) onRename(thread.id, next);
    setRenaming(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(thread.title);
      setRenaming(false);
    }
  };

  if (renaming) {
    return localize((
      <div className="rounded-2lg bg-background-secondary-hover px-2 py-1.5">
        <label className="sr-only" htmlFor={`rename-${thread.id}`}>
          重命名对话
        </label>
        <input
          id={`rename-${thread.id}`}
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          className="w-full bg-transparent text-body-2-regular text-text-primary outline-none"
        />
      </div>
    ));
  }

  return localize((
    <div
      className={cx(
        "group/row relative flex items-center rounded-2lg transition-colors",
        // Stepped off the rail's own surface. The rail moved to `secondary`
        // when it became a card of its own, and `primary-hover` resolves to
        // exactly that colour in light — selection would have been invisible.
        // Selection and hover share the fill, so hovering previews selecting.
        active || menuOpen
          ? "bg-background-secondary-hover"
          : "hover:bg-background-secondary-hover",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(thread.id)}
        disabled={disabled}
        aria-current={active ? "true" : undefined}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 py-1.5 ps-2 text-start disabled:cursor-not-allowed disabled:opacity-50"
      >
        {thread.unread && (
          <span
            aria-label="未读"
            className="size-1.5 shrink-0 rounded-full bg-button-primary"
          />
        )}
        <span
          className={cx(
            "min-w-0 flex-1 truncate text-body-2-regular",
            thread.unread ? "text-text-primary" : "text-text-secondary",
          )}
        >
          {thread.title}
        </span>
      </button>

      {/* The age and the menu share one slot: the age steps aside on hover so
          the control appears in place rather than shifting the title.
          The two must never be visible together, so they are driven by one
          condition each way. `focus-visible` rather than `focus-within` is the
          load-bearing part: closing the menu with the pointer hands focus back
          to the trigger, and `focus-within` would keep the icon lit on top of
          the age that has already returned. */}
      <span className="group/slot relative flex size-7 shrink-0 items-center justify-center pe-1">
        <span
          aria-hidden={menuOpen}
          className={cx(
            "text-caption-1-regular text-text-tertiary transition-opacity",
            menuOpen
              ? "opacity-0"
              : "opacity-100 group-hover/row:opacity-0 group-has-[:focus-visible]/slot:opacity-0",
          )}
        >
          {relativeTime(thread.updatedAt)}
        </span>

        <span
          className={cx(
            // Nudged 1px left of the age badge's centre: the glyph reads as
            // sitting slightly right in its own box, so the optical centre and
            // the geometric one do not agree.
            "absolute inset-0 flex -translate-x-px items-center justify-center transition-opacity",
            menuOpen
              ? "opacity-100"
              : "opacity-0 group-hover/row:opacity-100 group-has-[:focus-visible]/slot:opacity-100",
          )}
        >
          <RowMenu
            title={thread.title}
            isOpen={menuOpen}
            onOpenChange={setMenuOpen}
            onRename={() => {
              setDraft(thread.title);
              setRenaming(true);
            }}
            onToggleUnread={() => onToggleUnread(thread.id)}
            onDelete={() => onDelete(thread.id)}
            deleteDisabled={disabled && active}
          />
        </span>
      </span>
    </div>
  ));
}

/** DropdownTrigger is itself the button, so it is styled directly — putting an
 *  IconButton inside it would nest one button in another. */
function RowMenu({
  title,
  isOpen,
  onOpenChange,
  onRename,
  onToggleUnread,
  onDelete,
  deleteDisabled,
}: {
  title: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onToggleUnread: () => void;
  onDelete: () => void;
  deleteDisabled: boolean;
}) {
  const localize = useTemplateCopy();
  const choose = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  return localize((
    <Dropdown isOpen={isOpen} onOpenChange={onOpenChange}>
      <DropdownTrigger
        aria-label={`更多操作：${title}`}
        className={cx(
          "inline-flex size-6 shrink-0 items-center justify-center rounded-md",
          "text-foreground-icon-secondary transition-colors duration-150 ease",
          "hover:bg-background-tertiary-default hover:text-foreground-icon-primary",
          isOpen && "bg-background-tertiary-default text-foreground-icon-primary",
        )}
      >
        <EllipsisVerticalIcon className="size-4 shrink-0" aria-hidden />
      </DropdownTrigger>

      <DropdownPopover
        aria-label={`更多操作：${title}`}
        placement="bottom end"
        className="w-[190px] p-2"
      >
        <DropdownGroup>
          <DropdownItem onSelect={choose(onRename)} className="px-2 py-1.5">
            <span className="truncate text-body-medium whitespace-nowrap text-text-primary">重命名</span>
          </DropdownItem>
          <DropdownItem onSelect={choose(onToggleUnread)} className="px-2 py-1.5">
            <span className="truncate text-body-medium whitespace-nowrap text-text-primary">
              标为未读
            </span>
          </DropdownItem>
          <DropdownItem disabled={deleteDisabled} onSelect={choose(onDelete)} className="px-2 py-1.5">
            <span className="truncate text-body-medium whitespace-nowrap text-text-error-primary">删除</span>
          </DropdownItem>
        </DropdownGroup>
      </DropdownPopover>
    </Dropdown>
  ));
}

/** Compact ages for a narrow badge: now, 34m, 5h, 18h, 3d. */
function relativeTime(at: number) {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
