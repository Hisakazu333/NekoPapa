import { useEffect, useState } from "react";
import { Undo2Icon } from "@/components/foundations/icons/app-icons";
import { contrastRatio, themeById, themeColorKeys, type ThemeMode } from "@/app/appearance-themes";
import { Button } from "@/components/base/buttons/button";
import { tokenHex } from "@/platform/token-color";
import { AppearanceThemePicker } from "./appearance-theme-picker";
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
      {value && <Button size="xs" variant="ghost" leadingIcon={Undo2Icon} onClick={() => onChange("")} aria-label={`${label}恢复为跟随主题`}>恢复</Button>}
      <ColorPill label={label} value={value || themeValue || shown} onChange={onChange} />
    </div>
  </SettingsRow>;
}

/**
 * 主题: a picker of preset palettes previewed in the mode on screen, plus the
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
      <SettingsRow label="配色方案" description={`整套背景、前景与强调色，预览为当前${modeLabel}模式；浅色和深色各有对应版本。`}>
        <AppearanceThemePicker value={theme.id} mode={mode}
          onChange={(key) => onChange({ theme: key, backgroundLight: "", foregroundLight: "", backgroundDark: "", foregroundDark: "", followAccent: key !== "default" })} />
      </SettingsRow>
      {theme.id !== "default" && !theme[mode] && <p role="status" className="py-2.5 pe-3 text-body-2-regular text-text-secondary">
        <span translate="no">{theme.label}</span> 没有{modeLabel}版本，{modeLabel}模式下使用默认配色（可在下方自定义）。
      </p>}
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
