import { useEffect, useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "@/components/foundations/icons/app-icons";
import { APPEARANCE_THEMES, themeById, type AppearanceTheme, type ThemeMode } from "@/app/appearance-themes";
import { Input } from "@/components/base/input/input";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { RadioCard } from "@/components/base/radio/radio-card";
import { RadioGroup } from "@/components/base/radio/radio";
import { cx } from "@/utils/cx";

/**
 * A small window in a theme's colours for the mode on screen: a sidebar
 * strip, two lines of text and an accent pill. The default theme has no
 * fixed colours, so its swatch is painted with the app's own tokens.
 */
export function ThemeSwatch({ theme, mode, className }: { theme: AppearanceTheme; mode: ThemeMode; className?: string }) {
  const colors = theme[mode] ?? theme.dark ?? theme.light;
  const mix = (amount: number) => colors && `color-mix(in oklab, ${colors.foreground} ${amount}%, ${colors.background})`;
  return <span aria-hidden className={cx("flex aspect-[1.7] shrink-0 overflow-hidden rounded-lg border border-separator-border",
    !colors && "bg-background-full", className)} style={colors && { background: colors.background }}>
    <span className={cx("flex w-1/4 flex-col gap-0.5 p-1", !colors && "bg-background-secondary-default")} style={colors && { background: mix(6) }}>
      {[0, 1, 2].map((row) => <span key={row} className={cx("h-0.5 rounded-full", !colors && "bg-foreground-icon-tertiary")} style={colors && { background: mix(35) }} />)}
    </span>
    <span className="flex flex-1 flex-col justify-center gap-1 px-1.5">
      <span className={cx("h-1 w-4/5 rounded-full", !colors && "bg-text-primary")} style={colors && { background: colors.foreground }} />
      <span className={cx("h-1 w-3/5 rounded-full", !colors && "bg-text-tertiary")} style={colors && { background: mix(55) }} />
      <span className={cx("h-1.5 w-1/3 rounded-full", !colors && "bg-accent-600")} style={colors && { background: colors.accent }} />
    </span>
  </span>;
}

const onlyMode = (theme: AppearanceTheme) => theme.id !== "default" && !(theme.light && theme.dark) ? (theme.dark ? "仅深色" : "仅浅色") : undefined;

/**
 * 主题 as one row: the chosen theme's swatch and name, which opens a
 * searchable list of every preset (previewed in the mode on screen) instead
 * of laying all of them out on the page. Picking one closes the list.
 */
export function AppearanceThemePicker({ value, mode, onChange }: { value: string; mode: ThemeMode; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const theme = themeById(value);
  const words = query.trim().toLocaleLowerCase();
  const shown = APPEARANCE_THEMES.filter((item) => !words || item.label.toLocaleLowerCase().includes(words) || item.id.includes(words));
  const toggle = (next: boolean) => { setOpen(next); if (!next) setQuery(""); };
  const list = useRef<HTMLDivElement>(null);
  // Long list: start with the chosen theme in view.
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const box = list.current;
      const item = box?.querySelector<HTMLElement>("[data-selected]");
      // Scroll only the list, not the settings page behind the popover.
      if (box && item) box.scrollTop = item.offsetTop - (box.clientHeight - item.offsetHeight) / 2;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return <PopoverTrigger isOpen={open} onOpenChange={toggle}>
    <AriaButton aria-label={`主题：${theme.label}，点按选择（共 ${APPEARANCE_THEMES.length} 个）`}
      className={cx(
        "flex h-9 min-w-0 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border-button-default bg-background-primary-default ps-1.5 pe-2 outline-none",
        "transition-colors duration-150 hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring",
      )}>
      <ThemeSwatch theme={theme} mode={mode} className="h-6 rounded-full" />
      <span translate="no" className="max-w-40 truncate text-body-2-medium text-text-primary">{theme.label}</span>
      <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-foreground-icon-tertiary" />
    </AriaButton>
    <Popover aria-label="选择主题" placement="bottom end" className="w-[320px]" dialogClassName="flex flex-col gap-2 p-2">
      <Input aria-label="搜索主题" placeholder={`搜索 ${APPEARANCE_THEMES.length} 个主题`} size="small" type="search" autoFocus
        value={query} onChange={setQuery} leadingIcon={SearchIcon} />
      <div ref={list} className="relative max-h-[min(320px,40dvh)] overflow-y-auto overscroll-contain">
        {shown.length === 0
          ? <p role="status" className="px-2 py-6 text-center text-body-2-regular text-text-tertiary">没有匹配的主题。</p>
          : <RadioGroup aria-label="主题" value={theme.id} className="flex flex-col gap-0.5"
            onChange={(key) => { onChange(key); toggle(false); }}>
            {shown.map((item) => {
              const only = onlyMode(item);
              return <RadioCard key={item.id} value={item.id} aria-label={only ? `${item.label}（${only}）` : item.label} showRadio={false}
                className={(state) => cx("min-w-0 flex-row items-center gap-3 rounded-xl border-transparent px-1.5 py-1.5",
                  state.isHovered ? "bg-background-primary-hover" : state.isSelected ? "bg-background-secondary-default" : "bg-transparent")}>
                <ThemeSwatch theme={item} mode={mode} className="h-7" />
                <span translate="no" className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">{item.label}</span>
                {only && <span className="shrink-0 text-caption-1-regular text-text-tertiary">{only}</span>}
                {item.id === theme.id && <CheckIcon aria-hidden className="size-4 shrink-0 text-text-primary" />}
              </RadioCard>;
            })}
          </RadioGroup>}
      </div>
    </Popover>
  </PopoverTrigger>;
}
