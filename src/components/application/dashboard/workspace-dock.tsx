import { type ComponentType, type ReactNode } from "react";
import { Button } from "@/components/base/buttons/button";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import { cx } from "@/utils/cx";

interface DockEntry {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  onSelect?: () => void;
  selected?: boolean;
  panel?: { content: (close: () => void) => ReactNode; className?: string };
  renderControl?: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
}

interface DockGroup {
  key: string;
  label: string;
  entries: DockEntry[];
}

const tileSize = "h-10 w-10 @max-[500px]:w-8 @max-[400px]:w-7 @max-[360px]:w-6";
const tileClass = "group relative flex shrink-0 items-center justify-center rounded-xl outline-none";

function TileLabel({ label }: { label: string }) {
  return <span aria-hidden className={cx(
    "pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-lg bg-background-primary-default px-2 py-1",
    "left-1/2 -translate-x-1/2",
    "text-caption-1-medium text-text-primary shadow-sidebar opacity-0 transition-opacity duration-100",
    "group-hover:opacity-100 group-focus-visible:opacity-100 group-has-[:focus-visible]:opacity-100 motion-reduce:transition-none",
  )}>{label}</span>;
}

/** Primary destinations lead the dock. Auxiliary panels anchor to their own buttons. */
export function WorkspaceDock({ groups, openPanel, onPanelChange }: {
  groups: DockGroup[];
  openPanel: string | null;
  onPanelChange: (key: string | null) => void;
}) {
  const localize = useTemplateCopy();
  const setPanel = (key: string, open: boolean) => {
    // A modal opened inside a dock panel keeps its parent panel mounted.
    if (!open && document.activeElement?.closest("[role=alertdialog], [aria-modal=true]")) return;
    onPanelChange(open ? key : openPanel === key ? null : openPanel);
  };

  return localize(<div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex justify-center @container">
    <nav aria-label="主导航" className="pointer-events-auto inline-flex items-center rounded-2xl border border-border-button-default bg-background-primary-default p-1 shadow-md">
      {groups.map((group, index) => <div key={group.key} role="group" aria-label={group.label}
        className={cx("flex items-center gap-0.5 @max-[500px]:gap-0",
          index > 0 && "before:mx-1 before:h-5 before:w-px before:bg-separator-border")}>
        {group.entries.map((entry) => {
          const open = openPanel === entry.key;
          if (entry.renderControl) return <div key={entry.key} className={cx(tileClass, tileSize)}>
            {entry.renderControl(open, (next) => setPanel(entry.key, next))}
            {!open && <TileLabel label={entry.label} />}
          </div>;
          const tile = <Button key={entry.key} variant="ghost" leadingIcon={entry.icon} aria-label={entry.label}
            aria-current={entry.selected ? "page" : undefined} onClick={entry.panel ? undefined : entry.onSelect}
            className={cx(
              tileClass, tileSize,
              "overflow-visible gap-0 p-0 focus-visible:ring-offset-0 [&>span]:px-0 [&>svg]:size-[18px] @max-[380px]:[&>svg]:size-4",
              "bg-transparent text-foreground-icon-secondary hover:bg-background-secondary-hover hover:text-text-primary",
              open && "bg-background-secondary-hover text-text-primary",
              entry.selected && "bg-background-secondary-default text-foreground-icon-primary after:absolute after:bottom-1 after:size-1 after:rounded-full after:bg-accent-500",
            )}>
            {!open && <TileLabel label={entry.label} />}
          </Button>;
          if (!entry.panel) return tile;
          const panel = entry.panel;
          return <PopoverTrigger key={entry.key} isOpen={open} onOpenChange={(next) => setPanel(entry.key, next)}>
            {tile}
            <Popover aria-label={entry.label} placement="top" offset={10}
              className={cx("w-[320px] max-w-[calc(100vw-24px)]", panel.className)} dialogClassName="p-0">
              {panel.content(() => onPanelChange(null))}
            </Popover>
          </PopoverTrigger>;
        })}
      </div>)}
    </nav>
  </div>);
}
