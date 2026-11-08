import { useId, type ReactNode } from "react";
import { ChevronDownSmall } from "@/components/foundations/icons/chevrons";
import { cx } from "@/utils/cx";

export function ContactSection({ title, count, collapsed, onToggle, children }: {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const contentId = useId();
  const titleId = useId();
  return <section aria-labelledby={titleId} className="pt-3">
    <h2><button type="button" id={titleId} aria-expanded={!collapsed} aria-controls={contentId} onClick={onToggle}
      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-start text-caption-1-medium text-text-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring">
      <ChevronDownSmall className={cx("size-3 shrink-0 text-foreground-icon-secondary transition-transform motion-reduce:transition-none", collapsed && "-rotate-90")} />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <span className="text-text-tertiary" aria-hidden>{count}</span>
    </button></h2>
    <div id={contentId} hidden={collapsed}>{children}</div>
  </section>;
}
