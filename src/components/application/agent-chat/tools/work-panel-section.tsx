import type { ComponentType, ReactNode } from "react";
import { ChevronRightIcon } from "@/components/foundations/icons/app-icons";
import { cx } from "@/utils/cx";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/**
 * One section of the 环境与上下文 panel. Sections sit on one surface and are
 * divided by hairlines (the parent uses `divide-y`), each led by its title;
 * a section that only links somewhere passes `onPress` and renders as a
 * single row with a chevron.
 */
export function WorkPanelSection({ title, trailing, onPress, children }: {
  title: string;
  /** Muted text at the end of the title row, e.g. a count. */
  trailing?: ReactNode;
  onPress?: () => void;
  children?: ReactNode;
}) {
  if (onPress) return <section aria-label={title} className="py-1.5">
    <button type="button" onClick={onPress}
      className="-mx-2 flex h-10 w-[calc(100%+1rem)] cursor-pointer items-center gap-1 rounded-lg px-2 text-start outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
      <span className="text-body-medium text-text-primary">{title}</span>
      <ChevronRightIcon className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-end text-caption-1-regular text-text-secondary tabular-nums">{trailing}</span>
    </button>
  </section>;
  return <section aria-label={title} className="flex flex-col gap-1.5 py-3">
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-body-medium text-text-primary">{title}</h3>
      {trailing && <span className="min-w-0 truncate text-caption-1-regular text-text-secondary tabular-nums">{trailing}</span>}
    </div>
    {children}
  </section>;
}

/** An icon row inside a section: label, optional detail beneath, optional value or control at the end. */
export function WorkPanelRow({ icon: RowIcon, label, detail, end, title }: {
  icon: Icon;
  label: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
  title?: string;
}) {
  return <li title={title} className={cx("flex items-center gap-2.5", detail ? "min-h-11 py-1" : "h-9")}>
    <RowIcon className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
    <div className="min-w-0 flex-1">
      <p className="truncate text-body-2-regular text-text-primary">{label}</p>
      {detail && <p className="truncate text-caption-1-regular text-text-tertiary">{detail}</p>}
    </div>
    {end !== undefined && <div className="flex shrink-0 items-center gap-1 text-caption-1-regular text-text-secondary">{end}</div>}
  </li>;
}
