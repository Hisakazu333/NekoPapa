import type { ReactNode } from "react";
import { Button, Disclosure, DisclosurePanel } from "react-aria-components";
import { ChevronDownIcon } from "@/components/foundations/icons/app-icons";

export function WorkPanelSection({ title, summary, children, defaultExpanded }: {
  title: string;
  summary?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  return <Disclosure defaultExpanded={defaultExpanded} className="group/section min-w-0 shrink-0 rounded-2xl border border-separator-border bg-background-primary-default">
    <h3>
      <Button slot="trigger" className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-start outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring">
        <ChevronDownIcon className="size-4 shrink-0 -rotate-90 text-foreground-icon-secondary transition-transform motion-reduce:transition-none group-data-[expanded]/section:rotate-0" aria-hidden />
        <span className="min-w-0 flex-1 text-body-2-medium text-text-primary">{title}</span>
        {summary && <span className="min-w-0 text-end text-caption-1-regular text-text-secondary tabular-nums">{summary}</span>}
      </Button>
    </h3>
    <DisclosurePanel className="px-3 pb-3">{children}</DisclosurePanel>
  </Disclosure>;
}
