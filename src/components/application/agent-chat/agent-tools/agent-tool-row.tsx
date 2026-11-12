import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronRightIcon, CircleAlertIcon } from "@/components/foundations/icons/app-icons";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { cx } from "@/utils/cx";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/**
 * One tool call as a single line ("读取了 src/app.ts"), like the reasoning
 * line above a reply: a spinner while it runs, an alert when it failed, and a
 * fold-out with what it returned.
 */
export function AgentToolRow({ icon: RowIcon, title, running = false, failed = false, detail, children }: {
  icon: Icon;
  title: string;
  running?: boolean;
  failed?: boolean;
  /** Short trailing note, e.g. "12 处". */
  detail?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(children);
  const label = <>
    {running ? <SpinnerGlyph size="xs" className="size-3.5 shrink-0" />
      : failed ? <CircleAlertIcon className="size-3.5 shrink-0 text-text-error-primary" aria-hidden />
        : <RowIcon className="size-3.5 shrink-0" aria-hidden />}
    <span translate="no" className={cx("min-w-0 truncate", running && "animate-pulse")}>{title}</span>
    {detail && <span className="shrink-0 text-text-tertiary">{detail}</span>}
    {expandable && <ChevronRightIcon className={cx("size-3.5 shrink-0 transition-transform", open && "rotate-90")} aria-hidden />}
  </>;
  const row = "flex w-fit max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-caption-1-medium text-text-tertiary";
  return <div className="flex min-w-0 flex-col gap-1">
    {expandable
      ? <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}
        className={cx(row, "cursor-pointer outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring")}>{label}</button>
      : <div className={row}>{label}</div>}
    {open && <div className="ms-2.5 max-h-72 overflow-auto border-s border-separator-border ps-3 text-caption-1-regular text-text-tertiary">{children}</div>}
  </div>;
}
