import { useEffect, useMemo, useState } from "react";
import { ArrowRightIcon, MessageCircleIcon, PlusIcon } from "@/components/foundations/icons/app-icons";
import type { StoredThread } from "@/components/application/agent-chat/thread-storage";
import { messageText } from "@/components/application/agent-chat/thread-storage";
import { resolveProject, type Project } from "@/app/projects/projects";
import { cx } from "@/utils/cx";
import { groupThreadsByDay, recentAge } from "./sidebar-recent-groups";

/** Re-renders once a minute so age badges stay current without reading the clock during render. */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * 对话 in the dock's panel. The dock has no sidebar to fall back on, so this
 * has to answer the whole question by itself: which chats exist, what they are
 * about, and how to get back into one. Rows lead with the latest message
 * rather than an icon, group by day instead of by folder (recency is what you
 * scan for when switching), and carry the project inline. 新建对话 and
 * 全部对话 (the sidebar's full tree, with renaming and deletion) are one press
 * away at the top and bottom.
 */
export function DockConversationsPanel({ threads, projects, activeId, busy, onCreate, onSelect, onShowAll }: {
  threads: StoredThread[];
  projects: readonly Project[];
  activeId: string;
  busy: boolean;
  onCreate: () => void;
  onSelect: (thread: StoredThread) => void;
  onShowAll: () => void;
}) {
  const now = useMinuteClock();
  const groups = useMemo(() => groupThreadsByDay(
    threads.filter((thread) => !thread.contact && thread.messages.length > 0),
    now,
  ), [now, threads]);
  const total = groups.reduce((count, group) => count + group.threads.length, 0);

  return <div className="flex min-w-0 flex-col">
    <div className="flex items-center justify-between gap-2 px-2 pb-1.5 pt-0.5">
      <span className="text-body-2-medium text-text-tertiary">对话</span>
      <button type="button" onClick={onCreate} disabled={busy}
        className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-body-2-medium text-text-secondary outline-none hover:bg-background-secondary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-50">
        <PlusIcon className="size-3.5" aria-hidden />新建
      </button>
    </div>

    <div className="max-h-[min(60dvh,440px)] overflow-y-auto overscroll-contain [scrollbar-width:thin]">
      {groups.map((group) => <div key={group.key} className="flex min-w-0 flex-col gap-px py-1">
        <span className="px-2 pb-0.5 text-caption-1-medium text-text-tertiary">{group.label}</span>
        {group.threads.map((thread) => {
          const active = thread.id === activeId;
          const disabled = busy && !active;
          const preview = [...thread.messages].reverse().map(messageText).find((text) => text.trim()) ?? "";
          const project = resolveProject(projects, thread.project);
          const title = thread.title === "New chat" ? "新对话" : thread.title;
          return <button key={thread.id} type="button" onClick={() => onSelect(thread)} disabled={disabled}
            aria-current={active ? "true" : undefined} title={preview ? `${title} · ${preview}` : title}
            className={cx(
              "group/row flex min-w-0 cursor-pointer flex-col items-stretch gap-0.5 rounded-2lg px-2 py-1.5 text-start outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-50",
              active ? "bg-background-tertiary-hover" : "hover:bg-background-primary-hover",
            )}>
            <span className="flex min-w-0 items-center gap-1.5">
              {thread.unread && <span className="size-1.5 shrink-0 rounded-full bg-accent-600" aria-label="未读" />}
              <span translate={thread.title === "New chat" ? undefined : "no"}
                className={cx("min-w-0 flex-1 truncate text-body-2-medium", active ? "text-text-primary" : "text-text-secondary")}>{title}</span>
              <time className="shrink-0 text-caption-1-medium text-text-tertiary">{recentAge(thread.updatedAt, now)}</time>
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-caption-1-regular text-text-tertiary">
              {project && <span className="truncate rounded bg-background-secondary-default px-1 py-px text-text-secondary">{project.name}</span>}
              {preview ? <span className="min-w-0 flex-1 truncate">{preview}</span> : <span className="min-w-0 flex-1 truncate">还没有消息</span>}
            </span>
          </button>;
        })}
      </div>)}
      {total === 0 && <div className="flex flex-col items-start gap-2 px-2 py-3">
        <p className="text-body-2-regular text-text-tertiary">还没有对话。开始聊天后会按时间显示在这里。</p>
        <button type="button" onClick={onCreate} disabled={busy}
          className="flex cursor-pointer items-center gap-1.5 rounded-2lg bg-background-secondary-default px-2.5 py-1.5 text-body-2-medium text-text-secondary outline-none hover:bg-background-secondary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-50">
          <MessageCircleIcon className="size-4" aria-hidden />开始新对话
        </button>
      </div>}
    </div>

    <button type="button" onClick={onShowAll}
      className="mt-1 flex cursor-pointer items-center justify-between gap-2 rounded-2lg px-2 py-1.5 text-body-2-medium text-text-tertiary outline-none hover:bg-background-secondary-hover hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
      全部对话与项目<ArrowRightIcon className="size-3.5" aria-hidden />
    </button>
  </div>;
}
