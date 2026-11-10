import { useEffect, useState } from "react";
import { RiArrowGoBackLine } from "@remixicon/react";
import { APPEARANCE_THEMES, contrastRatio, themeById, themeColorKeys, type AppearanceTheme, type ThemeMode } from "@/app/appearance-themes";
import { Button } from "@/components/base/buttons/button";
import { RadioCard } from "@/components/base/radio/radio-card";
import { RadioGroup } from "@/components/base/radio/radio";
import { tokenHex } from "@/platform/token-color";
import { cx } from "@/utils/cx";
import { ColorPill } from "./appearance-color-pill";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";

export interface ThemeDraft {
  theme: string;
  backgroundLight: string;
  foregroundLight: string;
  backgroundDark: string;
  foregroundDark: string;
}
export const THEME_DRAFT_KEYS = ["theme", "backgroundLight", "foregroundLight", "backgroundDark", "foregroundDark"] as const;

/**
 * A small window in a theme's colours for the mode on screen: a sidebar
 * strip, two lines of text and an accent pill. The default theme has no
 * fixed colours, so its card is painted with the app's own tokens.
 */
function ThemeSwatch({ theme, mode }: { theme: AppearanceTheme; mode: ThemeMode }) {
  const colors = theme[mode] ?? theme.dark ?? theme.light;
  const mix = (amount: number) => colors && `color-mix(in oklab, ${colors.foreground} ${amount}%, ${colors.background})`;
  return <span aria-hidden className={cx("flex aspect-[1.7] w-full overflow-hidden rounded-xl border border-separator-border",
    !colors && "bg-background-full")} style={colors && { background: colors.background }}>
    <span className={cx("flex w-1/4 flex-col gap-1 p-1.5", !colors && "bg-background-secondary-default")} style={colors && { background: mix(6) }}>
      {[0, 1, 2].map((row) => <span key={row} className={cx("h-1 rounded-full", !colors && "bg-foreground-icon-tertiary")} style={colors && { background: mix(35) }} />)}
    </span>
    <span className="flex flex-1 flex-col justify-center gap-1.5 px-2">
      <span className={cx("h-1.5 w-4/5 rounded-full", !colors && "bg-text-primary")} style={colors && { background: colors.foreground }} />
      <span className={cx("h-1.5 w-3/5 rounded-full", !colors && "bg-text-tertiary")} style={colors && { background: mix(55) }} />
      <span className={cx("h-2.5 w-8 rounded-full", !colors && "bg-accent-600")} style={colors && { background: colors.accent }} />
    </span>
  </span>;
}

function ThemeCard({ theme, mode }: { theme: AppearanceTheme; mode: ThemeMode }) {
  const only = theme.id !== "default" && !(theme.light && theme.dark) ? (theme.dark ? "仅深色" : "仅浅色") : undefined;
  return <RadioCard value={theme.id} aria-label={only ? `${theme.label}（${only}）` : theme.label} showRadio={false}
    className={(state) => cx("min-w-0 flex-col items-stretch gap-1.5 p-1.5", state.isSelected && "border-border-focus-ring ring-2 ring-border-focus-ring")}>
    <ThemeSwatch theme={theme} mode={mode} />
    <span className="flex min-w-0 items-baseline justify-between gap-1 px-0.5">
      <span translate="no" className="truncate text-body-2-medium text-text-primary">{theme.label}</span>
      {only && <span className="shrink-0 text-caption-1-regular text-text-tertiary">{only}</span>}
    </span>
  </RadioCard>;
}

/** The colour the window shows now for a token (after the preview has been applied). */
function useShownColor(token: string, refresh: string) {
  const [hex, setHex] = useState<string>();
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setHex(tokenHex(token)));
    return () => window.cancelAnimationFrame(frame);
  }, [token, refresh]);
  return hex;
}

function ColorRow({ label, value, themeValue, themeLabel, shown, onChange }: {
  label: string; value: string; themeValue?: string; themeLabel: string; shown?: string; onChange: (next: string) => void;
}) {
  return <SettingsRow label={label} description={value ? "已自定义。" : themeValue ? `跟随 ${themeLabel}。` : "应用默认配色。"}>
    <div className="flex shrink-0 items-center gap-1">
      {value && <Button size="xs" variant="ghost" leadingIcon={RiArrowGoBackLine} onClick={() => onChange("")} aria-label={`${label}恢复为跟随主题`}>恢复</Button>}
      <ColorPill label={label} value={value || themeValue || shown} onChange={onChange} />
    </div>
  </SettingsRow>;
}

/**
 * 主题: a grid of preset palettes previewed in the mode on screen, plus the
 * background and foreground for that mode as colour pills (light and dark
 * keep their own). Choosing a preset clears the custom colours and lets the
 * accent follow it. A theme needs both ends, so changing one colour also
 * keeps the other as shown.
 */
export function AppearanceThemeSection({ draft, mode, onChange, error }: {
  draft: ThemeDraft;
  mode: ThemeMode;
  onChange: (next: Partial<ThemeDraft> & { followAccent?: boolean }) => void;
  error?: string;
}) {
  const theme = themeById(draft.theme);
  const keys = themeColorKeys(mode);
  const modeLabel = mode === "dark" ? "深色" : "浅色";
  const refresh = [mode, ...THEME_DRAFT_KEYS.map((key) => draft[key])].join();
  const shownBackground = useShownColor("background-full", refresh);
  const shownForeground = useShownColor("text-primary", refresh);
  const background = draft[keys.background] || theme[mode]?.background || shownBackground;
  const foreground = draft[keys.foreground] || theme[mode]?.foreground || shownForeground;
  const ratio = background && foreground ? contrastRatio(background, foreground) : undefined;

  return <section className="flex flex-col gap-2" aria-label="主题">
    <SettingsSectionLabel>主题</SettingsSectionLabel>
    <SettingsCard>
      <div className="flex flex-col gap-3 p-3">
        <p className="text-body-2-regular text-text-secondary">整套背景、前景与强调色，预览为当前{modeLabel}模式；浅色和深色各有对应版本。</p>
        <RadioGroup aria-label="主题" value={theme.id} className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2"
          onChange={(key) => onChange({ theme: key, backgroundLight: "", foregroundLight: "", backgroundDark: "", foregroundDark: "", followAccent: key !== "default" })}>
          {APPEARANCE_THEMES.map((item) => <ThemeCard key={item.id} theme={item} mode={mode} />)}
        </RadioGroup>
        {theme.id !== "default" && !theme[mode] && <p role="status" className="text-body-2-regular text-text-secondary">
          <span translate="no">{theme.label}</span> 没有{modeLabel}版本，{modeLabel}模式下使用默认配色（可在下方自定义）。
        </p>}
      </div>
      <ColorRow label={`背景（${modeLabel}）`} value={draft[keys.background]} themeValue={theme[mode]?.background} themeLabel={theme.label}
        shown={shownBackground} onChange={(next) => onChange(next ? { [keys.background]: next, [keys.foreground]: foreground ?? "" } : { [keys.background]: "" })} />
      <ColorRow label={`前景（${modeLabel}）`} value={draft[keys.foreground]} themeValue={theme[mode]?.foreground} themeLabel={theme.label}
        shown={shownForeground} onChange={(next) => onChange(next ? { [keys.foreground]: next, [keys.background]: background ?? "" } : { [keys.foreground]: "" })} />
      {ratio !== undefined && ratio < 4.5 && <p role="status" className="px-3 pb-3 text-body-2-regular text-text-error-primary">
        前景与背景的对比度为 {ratio.toFixed(1)}:1，低于 4.5:1，正文可能看不清。
      </p>}
      {error && <p role="alert" className="px-3 pb-3 text-body-2-regular text-text-error-primary">{error}</p>}
    </SettingsCard>
  </section>;
}
