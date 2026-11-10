import type { ComponentType } from "react";
import { Button as AriaButton, ToggleButton as AriaToggleButton } from "react-aria-components";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { Kbd } from "@/components/base/kbd/kbd";
import { cx } from "@/utils/cx";
import { directionalIconClass } from "@/utils/directional-icon";

/**
 * Quiet icon control used in the window toolbar and chat header. The look is
 * the BoardUI Chat Starter's header action (28px, radius/md, secondary icon
 * colour, hover fill); a focus ring is added for keyboard use. Plain buttons
 * and DropdownTrigger share this class so both sides of the toolbar match.
 */
export const toolbarIconButtonClass = cx(
  "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md",
  "text-foreground-icon-secondary transition-colors duration-150 ease",
  "hover:bg-background-primary-hover hover:text-foreground-icon-primary",
  "outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-foreground-icon-secondary",
);

export const toolbarIconClass = "size-[18px] shrink-0";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/** Toolbar icon button with the BoardUI tooltip naming its action, and its shortcut when it has one. */
export function ToolbarIconButton({ icon: Icon, label, onPress, isDisabled = false, shortcut, className }: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
  isDisabled?: boolean;
  /** Shown beside the label in the tooltip, e.g. "⌘B". */
  shortcut?: string;
  className?: string;
}) {
  return (
    <TooltipTrigger>
      <AriaButton aria-label={label} onPress={onPress} isDisabled={isDisabled} className={cx(toolbarIconButtonClass, className)}>
        <Icon className={cx(toolbarIconClass, directionalIconClass(Icon))} aria-hidden />
      </AriaButton>
      <Tooltip placement="bottom">{shortcut ? <span className="flex items-center gap-2">{label}<Kbd>{shortcut}</Kbd></span> : label}</Tooltip>
    </TooltipTrigger>
  );
}

/**
 * The same quiet button as an on / off toggle for a panel (终端, 文件, …):
 * pressed state shows as the hover fill, and the tooltip names the action
 * and its shortcut.
 */
export function ToolbarToggleButton({ icon: Icon, label, isSelected, onChange, shortcut, isDisabled = false }: {
  icon: IconComponent;
  label: string;
  isSelected: boolean;
  onChange: () => void;
  shortcut?: string;
  isDisabled?: boolean;
}) {
  return (
    <TooltipTrigger>
      <AriaToggleButton aria-label={label} isSelected={isSelected} onChange={onChange} isDisabled={isDisabled}
        className={cx(toolbarIconButtonClass, "data-[selected]:bg-background-primary-hover data-[selected]:text-text-primary")}>
        <Icon className={toolbarIconClass} aria-hidden />
      </AriaToggleButton>
      <Tooltip placement="bottom">{shortcut ? <span className="flex items-center gap-2">{label}<Kbd>{shortcut}</Kbd></span> : label}</Tooltip>
    </TooltipTrigger>
  );
}
