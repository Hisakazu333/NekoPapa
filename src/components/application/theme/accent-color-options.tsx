import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import { parseColor, type Key } from "react-aria-components";
import { APPEARANCE_ACCENTS, type AppearanceAccent } from "@/app/appearance/appearance-preferences";
import { ColorWell } from "@/components/base/color-picker/color-picker";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { tokenHex } from "@/platform/token-color";
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
  const presetHex: Record<(typeof APPEARANCE_ACCENTS)[number]["id"], string> = {
    pink: "#ec4899", green: "#6f7b63", blue: "#597fa7", purple: "#8771a3", orange: "#a8754f",
  };
  const presetId = APPEARANCE_ACCENTS.some(({ id }) => id === value) ? value as keyof typeof presetHex : undefined;
  // "theme" (跟随主题) has no fixed colour: the well shows the accent the
  // theme paints right now. Anything parseColor would reject falls back to
  // pink instead of throwing during render (which blanked the whole app).
  const currentHex = presetId ? presetHex[presetId]
    : /^#[\da-f]{6}$/i.test(value) ? value
    : value === "theme" ? tokenHex("accent-500") ?? presetHex.pink : presetHex.pink;
  const select = (keys: Set<Key> | "all") => {
    if (keys === "all") return;
    const selected = Array.from(keys)[0];
    if (typeof selected === "string" && APPEARANCE_ACCENTS.some(({ id }) => id === selected)) {
      onChange(selected as AppearanceAccent);
    }
  };

  return localize((
    <div className={cx("flex min-w-0 items-center gap-1.5", disabled && "pointer-events-none opacity-50")} aria-disabled={disabled}>
      <SegmentedControl
        aria-label={label}
        selectedKeys={presetId ? [presetId] : []}
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
      <ColorWell aria-label="自定义强调色" value={parseColor(currentHex)}
        onChange={(color) => onChange(color.toString("hex").toLowerCase() as AppearanceAccent)}
        swatches={Object.values(presetHex)} wellClassName={compact ? "size-7" : "size-8"}
        className="w-full" placement="bottom end" />
    </div>
  ));
}
