import { useMemo, type RefObject } from "react";
import { RiListUnordered } from "@remixicon/react";
import type { UIMessage } from "ai";
import { chatOutline } from "@/app/chat-tools";
import { messageText } from "../thread-storage";
import { ToolPanelMessage } from "./tool-panel-frame";

const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

/**
 * 目录: what the user asked in the open chat, in order. Choosing an entry
 * scrolls the conversation to that message and moves focus there.
 */
export function ChatOutlineView({ messages, messageAt, scrollRef }: {
  messages: UIMessage[];
  messageAt: Record<string, number>;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const entries = useMemo(() => chatOutline(messages.map((message) => ({ id: message.id, role: message.role, text: messageText(message) }))), [messages]);

  const jump = (id: string) => {
    const target = scrollRef.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  };

  if (entries.length === 0) return <ToolPanelMessage icon={RiListUnordered} title="还没有消息" detail="发送消息后，这里按顺序列出你问过的内容，点一下即可跳到那里。" />;
  return <ol aria-label="对话目录" className="min-h-0 flex-1 overflow-auto px-2 pb-3">
    {entries.map((entry) => <li key={entry.id}>
      <button type="button" onClick={() => jump(entry.id)} title={entry.title}
        className="flex w-full cursor-pointer items-baseline gap-2 rounded-lg px-2 py-1.5 text-start outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <span className="w-5 shrink-0 text-end text-caption-1-regular text-text-tertiary tabular-nums">{entry.index}</span>
        <span className="min-w-0 flex-1 truncate text-body-2-regular text-text-primary">{entry.title}</span>
        {messageAt[entry.id] !== undefined && <span className="shrink-0 text-caption-1-regular text-text-tertiary tabular-nums">{time.format(messageAt[entry.id])}</span>}
      </button>
    </li>)}
  </ol>;
}
