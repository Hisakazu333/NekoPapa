import { Fragment, useRef, useState, type ComponentType, type MouseEvent } from "react";
import { Button as AriaButton } from "react-aria-components";
import { DOCK_TILE_SIZE, dockScale } from "@/app/dock-magnification";
import { cx } from "@/utils/cx";

export interface DockEntry {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  onSelect: () => void;
  selected?: boolean;
}

const reducedMotion = () => typeof window !== "undefined"
  && (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reducedMotion === "true");

/**
 * 底部悬浮栏: the workspace's main navigation as a floating bar centred at
 * the bottom of the window, chosen in 设置 → 外观 → 导航布局. Entries come in
 * groups split by a thin divider. With a mouse, tiles grow as the pointer
 * nears them (like the macOS Dock) and the label shows above the tile;
 * keyboard focus shows the label too. Magnification is off with reduced
 * motion. The bar floats over a strip the window frame keeps free, so it
 * never covers the composer.
 */
export function WorkspaceDock({ groups }: { groups: DockEntry[][] }) {
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
    if (reducedMotion()) return;
    if (!centers.current.size) measure();
    setScales(Object.fromEntries([...centers.current].map(([key, center]) => [key, dockScale(event.clientX - center)])));
  };
  const reset = () => { centers.current = new Map(); setScales({}); };

  return <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex justify-center px-3">
    <nav aria-label="主导航" onMouseEnter={measure} onMouseMove={track} onMouseLeave={reset}
      className={cx(
        "pointer-events-auto flex max-w-full items-end gap-1 overflow-visible rounded-[22px] p-1.5",
        "border border-border-button-white bg-background-secondary-default/85 shadow-sidebar backdrop-blur-xl",
      )}>
      {groups.filter((group) => group.length).map((group, index) => <Fragment key={group[0].key}>
        {index > 0 && <span aria-hidden className="mx-1 mb-2 h-6 w-px shrink-0 self-end bg-separator-border" />}
        {group.map((entry) => {
          const size = DOCK_TILE_SIZE * (scales[entry.key] ?? 1);
          return <AriaButton key={entry.key} aria-label={entry.label} aria-current={entry.selected ? "page" : undefined} onPress={entry.onSelect}
            ref={(node) => { if (node) tiles.current.set(entry.key, node); else tiles.current.delete(entry.key); }}
            style={{ width: size, height: size }}
            className={({ isFocusVisible }) => cx(
              "group relative flex shrink-0 cursor-pointer items-center justify-center rounded-[12px] outline-none",
              "transition-[width,height,background-color] duration-150 ease-out motion-reduce:transition-none",
              entry.selected ? "bg-linear-to-b from-accent-500 to-accent-600 text-white shadow-nav-selected"
                : "text-foreground-icon-secondary hover:bg-background-secondary-hover hover:text-foreground-icon-primary",
              isFocusVisible && "ring-2 ring-border-focus-ring",
            )}>
            <entry.icon className="size-[52%]" aria-hidden />
            <span aria-hidden className={cx(
              "pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-lg bg-background-primary-default px-2 py-1",
              "text-caption-1-medium text-text-primary shadow-sidebar opacity-0 transition-opacity duration-100",
              "group-hover:opacity-100 group-data-[focus-visible]:opacity-100",
            )}>{entry.label}</span>
          </AriaButton>;
        })}
      </Fragment>)}
    </nav>
  </div>;
}
