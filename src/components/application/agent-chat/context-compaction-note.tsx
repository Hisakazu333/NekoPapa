import { useState } from "react";
import { ChevronRightIcon, LayersIcon } from "@/components/foundations/icons/app-icons";
import type { Compaction } from "@/app/chat/context-compaction";
import { cx } from "@/utils/cx";

/**
 * Before the reply that summarized the chat to fit the model's context
 * window: a divider saying so, opening to the summary the model now works
 * from. The messages above stay in the transcript unchanged.
 */
export function ContextCompactionNote({ compaction }: { compaction: Compaction }) {
  const [open, setOpen] = useState(false);
  return <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className="h-px flex-1 bg-separator-border" aria-hidden />
      <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}
        className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-caption-1-medium text-text-tertiary outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <LayersIcon className="size-3.5" aria-hidden />
        已压缩上下文{compaction.messages ? `：之前 ${compaction.messages} 条消息整理为摘要` : ""}
        <ChevronRightIcon className={cx("size-3.5 transition-transform", open && "rotate-90")} aria-hidden />
      </button>
      <span className="h-px flex-1 bg-separator-border" aria-hidden />
    </div>
    {open && <p className="max-h-72 overflow-y-auto rounded-2xl border border-separator-border bg-background-primary-default px-3 py-2 text-body-2-regular whitespace-pre-wrap text-text-secondary">{compaction.summary}</p>}
  </div>;
}
