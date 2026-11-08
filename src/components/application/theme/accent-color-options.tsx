import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import type { Key } from "react-aria-components";
import { APPEARANCE_ACCENTS, type AppearanceAccent } from "@/app/appearance-preferences";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { cx } from "@/utils/cx";

export interface AccentColorOptionsProps {
  value: AppearanceAccent;
  onChange: (value: AppearanceAccent) => void;
  disabled?: boolean;
  label?: string;
  compact?: boolean;
}

/** Shared BoardUI single-select control for the application's accent colors. */
export function AccentColorOptions({
  value,
  onChange,
  disabled = false,
  label = "强调色",
  compact = false,
}: AccentColorOptionsProps) {
  const localize = useTemplateCopy();
  const select = (keys: Set<Key> | "all") => {
    if (keys === "all") return;
    const selected = Array.from(keys)[0];
    if (typeof selected === "string" && APPEARANCE_ACCENTS.some(({ id }) => id === selected)) {
      onChange(selected as AppearanceAccent);
    }
  };

  return localize((
    <SegmentedControl
      aria-label={label}
      selectedKeys={[value]}
      onSelectionChange={select}
      isDisabled={disabled}
      className={cx("w-fit max-w-full", compact && "gap-0.5")}
      variant={compact ? "plain" : "solid"}
    >
      {APPEARANCE_ACCENTS.map(({ id, label: name, swatchClass }) => (
        <SegmentedControlItem
          key={id}
          id={id}
          aria-label={name}
          className={compact
            ? (state) => cx("size-7 px-0", state.isSelected && "ring-2 ring-inset ring-border-focus-ring")
            : "gap-1.5 px-2"}
        >
          <span aria-hidden className={cx("size-3 shrink-0 rounded-full ring-1 ring-inset ring-border-button-default", swatchClass)} />
          {!compact && <span>{name}</span>}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  ));
}
