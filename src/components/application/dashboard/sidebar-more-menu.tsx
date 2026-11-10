import { useRef, type ComponentType } from "react";
import { Button as AriaButton } from "react-aria-components";
import { EllipsisIcon, PinFilledIcon, PinIcon } from "@/components/foundations/icons/app-icons";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { cx } from "@/utils/cx";
import { Collapsible } from "./sidebar-navigation";
import { useHoverIntent } from "./use-hover-intent";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

export interface SidebarMoreEntry {
  id: string;
  label: string;
  icon: IconComponent;
  pinned: boolean;
  onOpen: () => void;
}

/**
 * Codex-style "更多" row: opens a panel of secondary destinations. Each row
 * opens its destination; the pin button adds or removes it from the main
 * navigation. Resting the mouse on the row opens the panel and moving away
 * from both closes it (hover intent); press and the keyboard still toggle
 * it, and a panel opened from the keyboard stays until Escape or a choice.
 * Composed from BoardUI Popover and the sidebar row recipe.
 */
export function SidebarMoreMenu({ entries, collapsed, notice, onTogglePin }: {
  entries: SidebarMoreEntry[];
  collapsed: boolean;
  notice?: string;
  onTogglePin: (id: string) => void;
}) {
  const { open: isOpen, setOpen, hover, hoverProps } = useHoverIntent();
  // How and when the trigger was last pressed, so a close can tell a trigger
  // press (keyboard or a click after hovering) from an outside press.
  const pressed = useRef({ with: "mouse", at: 0 });
  const setIsOpen = (next: boolean) => setOpen(next, {
    keyboard: pressed.current.with === "keyboard",
    fromTrigger: Date.now() - pressed.current.at < 600,
  });
  return <PopoverTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
    <AriaButton aria-label="更多" onHoverStart={(event) => hover(true, event.pointerType)} onHoverEnd={(event) => hover(false, event.pointerType)}
      onPressStart={(event) => { pressed.current = { with: event.pointerType, at: Date.now() }; }} className={cx(
      "flex items-center overflow-hidden rounded-2lg p-2 text-start outline-none transition-[width,background-color] duration-300 ease-in-out",
      "hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring",
      collapsed ? "w-9" : "w-full", isOpen && "bg-background-secondary-hover",
    )}>
      <span className="flex min-w-0 items-center gap-2">
        <EllipsisIcon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
        <Collapsible collapsed={collapsed}><span className="text-body-medium whitespace-nowrap text-text-secondary">更多</span></Collapsible>
      </span>
    </AriaButton>
    <Popover aria-label="更多" placement={collapsed ? "end top" : "bottom start"} className="w-[248px] p-0" dialogClassName="p-0">
      <div {...hoverProps} className="flex flex-col p-1.5">
      <ul className="flex flex-col">
        {entries.map(({ id, label, icon: Icon, pinned, onOpen }) => <li key={id} className="group flex items-center rounded-2lg hover:bg-background-secondary-hover">
          <button type="button" onClick={() => { setIsOpen(false); onOpen(); }}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-2lg px-2 py-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
            <Icon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
            <span className="truncate text-body-medium text-text-primary">{label}</span>
          </button>
          <button type="button" aria-pressed={pinned} aria-label={pinned ? `从侧栏取消固定${label}` : `固定${label}到侧栏`} onClick={() => onTogglePin(id)}
            className={cx(
              "me-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none transition-opacity duration-150",
              "hover:bg-background-tertiary-default focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}>
            {pinned ? <PinFilledIcon className="size-4" aria-hidden /> : <PinIcon className="size-4" aria-hidden />}
          </button>
        </li>)}
      </ul>
      {notice && <p role="alert" className="px-2 pb-1.5 pt-1 text-body-2-regular text-text-error-primary">{notice}</p>}
      </div>
    </Popover>
  </PopoverTrigger>;
}
