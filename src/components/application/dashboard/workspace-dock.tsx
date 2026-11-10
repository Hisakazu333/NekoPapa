import { Fragment, useRef, useState, type ComponentType, type MouseEvent, type ReactNode } from "react";
import { Button as AriaButton } from "react-aria-components";
import { DOCK_TILE_SIZE, dockScale } from "@/app/navigation/dock-magnification";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { cx } from "@/utils/cx";

export interface DockEntry {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  onSelect?: () => void;
  selected?: boolean;
  /** Opens a panel above the dock instead of navigating (对话, 搜索, 更多). */
  panel?: { content: (close: () => void) => ReactNode; className?: string };
  /** A tile that brings its own control (the account avatar and its menu). */
  renderControl?: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
}

const reducedMotion = () => typeof window !== "undefined"
  && (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reducedMotion === "true");

// A modal opened from a panel (delete a chat, edit a project) holds focus;
// a press inside it is not a press outside the panel.
const modalOpen = () => Boolean(document.activeElement?.closest("[role=alertdialog], [aria-modal=true]"));

const tileClass = (selected: boolean | undefined, active: boolean) => cx(
  "group relative flex shrink-0 cursor-pointer items-center justify-center rounded-[12px] outline-none",
  "transition-[width,height,background-color] duration-150 ease-out motion-reduce:transition-none",
  "data-[focus-visible]:ring-2 data-[focus-visible]:ring-border-focus-ring",
  selected ? "bg-linear-to-b from-accent-500 to-accent-600 text-white shadow-nav-selected"
    : active ? "bg-background-secondary-hover text-foreground-icon-primary"
      : "text-foreground-icon-secondary hover:bg-background-secondary-hover hover:text-foreground-icon-primary",
);

function TileLabel({ label, hidden }: { label: string; hidden: boolean }) {
  return <span aria-hidden className={cx(
    "pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-lg bg-background-primary-default px-2 py-1",
    "text-caption-1-medium text-text-primary shadow-sidebar opacity-0 transition-opacity duration-100",
    !hidden && "group-hover:opacity-100 group-data-[focus-visible]:opacity-100",
  )}>{label}</span>;
}

/**
 * 底部悬浮栏: the workspace's main navigation as a floating bar centred at
 * the bottom of the window, chosen in 设置 → 外观 → 导航布局. Entries come in
 * groups split by a thin divider. Pages switch on press; 对话, 搜索 and 更多
 * open their panel above the bar, centred on it like a Dock stack, and the
 * account tile opens the account menu. With a mouse, tiles grow as the
 * pointer nears them (like the macOS Dock) and the label shows above the
 * tile; keyboard focus shows the label too. Magnification stops while a
 * panel is open, so the panel stays anchored, and with reduced motion. The
 * bar floats over a strip the window frame keeps free, so it never covers
 * the composer.
 */
export function WorkspaceDock({ groups, openPanel, onPanelChange }: {
  groups: DockEntry[][];
  /** The entry whose panel is open; owned by the caller so ⌘L can open 搜索. */
  openPanel: string | null;
  onPanelChange: (key: string | null) => void;
}) {
  const bar = useRef<HTMLElement>(null);
  const tiles = useRef(new Map<string, HTMLElement>());
  const centers = useRef(new Map<string, number>());
  const [scales, setScales] = useState<Record<string, number>>({});

  const measure = () => {
    centers.current = new Map([...tiles.current].map(([key, tile]) => {
      const rect = tile.getBoundingClientRect();
      return [key, rect.left + rect.width / 2];
    }));
  };
  const track = (event: MouseEvent<HTMLElement>) => {
    if (reducedMotion() || openPanel) return;
    if (!centers.current.size) measure();
    setScales(Object.fromEntries([...centers.current].map(([key, center]) => [key, dockScale(event.clientX - center)])));
  };
  const reset = () => { centers.current = new Map(); setScales({}); };
  const setPanel = (key: string, open: boolean) => {
    if (!open && modalOpen()) return;
    if (open) reset();
    onPanelChange(open ? key : openPanel === key ? null : openPanel);
  };
  const keep = (key: string) => (node: HTMLElement | null) => { if (node) tiles.current.set(key, node); else tiles.current.delete(key); };

  return <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex justify-center px-3">
    <nav ref={bar} aria-label="主导航" onMouseEnter={measure} onMouseMove={track} onMouseLeave={reset}
      className={cx(
        "pointer-events-auto flex max-w-full items-end gap-1 overflow-visible rounded-[22px] p-1.5",
        "border border-border-button-white bg-background-secondary-default/85 shadow-sidebar backdrop-blur-xl",
      )}>
      {groups.filter((group) => group.length).map((group, index) => <Fragment key={group[0].key}>
        {index > 0 && <span aria-hidden className="mx-1 mb-2 h-6 w-px shrink-0 self-end bg-separator-border" />}
        {group.map((entry) => {
          const size = DOCK_TILE_SIZE * (openPanel ? 1 : (scales[entry.key] ?? 1));
          const open = openPanel === entry.key;
          const Icon = entry.icon;
          if (entry.renderControl) return <div key={entry.key} ref={keep(entry.key)} style={{ width: size, height: size }}
            className="group relative flex shrink-0 items-center justify-center transition-[width,height] duration-150 ease-out motion-reduce:transition-none">
            {entry.renderControl(open, (next) => setPanel(entry.key, next))}
            <TileLabel label={entry.label} hidden={open} />
          </div>;
          const tile = <AriaButton key={entry.key} ref={keep(entry.key)} aria-label={entry.label}
            aria-current={entry.selected ? "page" : undefined} onPress={entry.panel ? undefined : entry.onSelect}
            style={{ width: size, height: size }} className={tileClass(entry.selected, open)}>
            {Icon && <Icon className="size-[52%]" aria-hidden />}
            <TileLabel label={entry.label} hidden={open} />
          </AriaButton>;
          if (!entry.panel) return tile;
          const panel = entry.panel;
          return <PopoverTrigger key={entry.key} isOpen={open} onOpenChange={(next) => setPanel(entry.key, next)}>
            {tile}
            <Popover aria-label={entry.label} placement="top" offset={10} triggerRef={bar}
              className={cx("w-[320px]", panel.className)} dialogClassName="p-0">
              {panel.content(() => onPanelChange(null))}
            </Popover>
          </PopoverTrigger>;
        })}
      </Fragment>)}
    </nav>
  </div>;
}
