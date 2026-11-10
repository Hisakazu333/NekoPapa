import { useEffect, useRef } from "react";
import { applyThemeWithTransition } from "@/components/application/theme/theme-toggle";
import { applyAppearanceAccent, normalizeAppearanceAccent, normalizeAppearanceMode, resolveAppearanceTheme } from "@/app/appearance/appearance-preferences";
import { applyThemeColors, normalizeThemeColor, normalizeThemeId, resolveThemeColors } from "@/app/appearance/appearance-themes";
import { useConfiguration } from "@/hooks/use-configuration";

/**
 * ConfigurationStore owns the preference; the root only presents it: the
 * light / dark class, the colour theme's neutral ramp for that mode, and the
 * accent (which may follow the theme).
 */
export function ConfiguredTheme() {
  const { data } = useConfiguration();
  const initialized = useRef(false);
  const appearance = data.groups.appearance;
  const mode = normalizeAppearanceMode(appearance.mode);
  const accent = normalizeAppearanceAccent(appearance.accent);
  const theme = normalizeThemeId(appearance.theme);
  const colors = [appearance.backgroundLight, appearance.foregroundLight, appearance.backgroundDark, appearance.foregroundDark].map(normalizeThemeColor);
  const colorKey = colors.join(",");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const [backgroundLight, foregroundLight, backgroundDark, foregroundDark] = colorKey.split(",");
    const update = () => {
      const resolved = resolveAppearanceTheme(mode, media.matches);
      const themed = resolveThemeColors({ theme, backgroundLight, foregroundLight, backgroundDark, foregroundDark }, resolved);
      applyThemeColors(document.documentElement, themed, theme);
      applyAppearanceAccent(document.documentElement, accent, themed?.accent);
      const focused = document.activeElement;
      void applyThemeWithTransition(resolved, {
        persist: false,
        animate: initialized.current,
        element: focused instanceof HTMLElement && focused !== document.body ? focused : null,
      });
      initialized.current = true;
    };
    update();
    if (mode !== "system") return;
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [mode, accent, theme, colorKey]);
  return null;
}
