import { useState } from "react";
import { ChevronRightIcon, LayersIcon } from "@/components/foundations/icons/app-icons";
import { cx } from "@/utils/cx";

/**
 * Before a reply that summarized part of the chat to fit the model's context
 * window (before it started, or between steps of its run): a divider saying
 * so, opening to the summary the model worked from. The transcript itself
 * stays unchanged.
 */
export function ContextCompactionNote({ label, summary }: { label: string; summary: string }) {
  const [open, setOpen] = useState(false);
  return <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className="h-px flex-1 bg-separator-border" aria-hidden />
      <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}
        className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-caption-1-medium text-text-tertiary outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <LayersIcon className="size-3.5" aria-hidden />
        {label}
        <ChevronRightIcon className={cx("size-3.5 transition-transform", open && "rotate-90")} aria-hidden />
      </button>
      <span className="h-px flex-1 bg-separator-border" aria-hidden />
    </div>
    {open && <p className="max-h-72 overflow-y-auto rounded-2xl border border-separator-border bg-background-primary-default px-3 py-2 text-body-2-regular whitespace-pre-wrap text-text-secondary">{summary}</p>}
  </div>;
}
