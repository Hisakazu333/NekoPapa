import { Button as AriaButton, parseColor } from "react-aria-components";
import { RiArrowDownSLine } from "@remixicon/react";
import { ColorPicker } from "@/components/base/color-picker/color-picker";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { cx } from "@/utils/cx";

/**
 * A colour shown as a swatch and its HEX in one pill: it always names the
 * colour on screen (a theme's or the app's own when nothing is custom), and
 * pressing it opens the editor — field, hue rail and a HEX field that takes
 * any CSS colour. Composed from BoardUI Popover and ColorPicker.
 */
export function ColorPill({ label, value, onChange }: { label: string; value?: string; onChange: (hex: string) => void }) {
  const color = value ? parseColor(value) : undefined;
  return <PopoverTrigger>
    <AriaButton aria-label={`${label}：${value ?? "读取中"}，点按修改`} isDisabled={!color}
      className={cx(
        "flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border-button-default bg-background-primary-default ps-1.5 pe-2 outline-none",
        "transition-colors duration-150 hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring",
        "disabled:cursor-default",
      )}>
      <span aria-hidden className="size-5 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" style={{ background: value }} />
      <span translate="no" className="w-[60px] text-start font-mono text-caption-1-regular text-text-primary uppercase">{value ?? "—"}</span>
      <RiArrowDownSLine aria-hidden className="size-4 text-foreground-icon-tertiary" />
    </AriaButton>
    <Popover aria-label={label} placement="bottom end" className="w-[248px] rounded-3xl" dialogClassName="p-1">
      {color && <ColorPicker value={color} onChange={(next) => onChange(next.toString("hex").toLowerCase())} className="w-full" />}
    </Popover>
  </PopoverTrigger>;
}
