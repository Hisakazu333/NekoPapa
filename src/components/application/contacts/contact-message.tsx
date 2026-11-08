import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import type { ChatContact } from "@/app/contacts-store";
import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";

export function ContactMessage({ text, isUser, contact, userName, at, streaming }: {
  text: string; isUser: boolean; contact: ChatContact; userName: string; at?: number; streaming: boolean;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (copyState === "idle") return;
    const timer = setTimeout(() => setCopyState("idle"), 1800);
    return () => clearTimeout(timer);
  }, [copyState]);
  if (!text) return null;
  const name = isUser ? userName : contact.name;
  return <li className={cx("group flex items-start gap-3", isUser && "flex-row-reverse")}>
    <Avatar size="md" src={isUser ? undefined : contact.avatar} initials={Array.from(name).slice(0, 1).join("")} alt={name} color={isUser ? "blue" : contact.avatarColor ?? "neutral"} className="mt-1 shrink-0" />
    <div className={cx("flex min-w-0 max-w-[82%] flex-col gap-1.5", isUser && "items-end")}>
      <span className="text-caption-1-regular text-text-tertiary">{isUser ? "我" : name}</span>
      <div className={cx("rounded-2xl px-4 py-3 text-body-regular break-words whitespace-pre-wrap", isUser
        ? "rounded-tr-md bg-button-primary text-white" : "rounded-tl-md border border-separator-border bg-background-full text-text-primary")}>
        {text}
      </div>
      <div className="flex min-h-5 items-center gap-2 text-caption-1-regular text-text-tertiary">
        {at ? <time dateTime={new Date(at).toISOString()}>{new Date(at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time> : null}
        {!streaming && <button type="button" className="flex cursor-pointer items-center gap-1 rounded px-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border-focus-ring" aria-label={`复制${name}的消息`} onClick={async () => {
          try { await navigator.clipboard.writeText(text); setCopyState("copied"); } catch { setCopyState("failed"); }
        }}>{copyState === "copied" ? <RiCheckLine className="size-3" aria-hidden /> : <RiFileCopyLine className="size-3" aria-hidden />}
          <span role="status">{copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制"}</span>
        </button>}
      </div>
    </div>
  </li>;
}
