import { useEffect, useRef } from "react";
import { applyThemeWithTransition } from "@/components/application/theme/theme-toggle";
import { applyAppearanceAccent, normalizeAppearanceAccent, normalizeAppearanceMode, resolveAppearanceTheme } from "@/app/appearance-preferences";
import { useConfiguration } from "@/hooks/use-configuration";

/** ConfigurationStore owns the preference; the root class only presents it. */
export function ConfiguredTheme() {
  const { data } = useConfiguration();
  const initialized = useRef(false);
  const mode = normalizeAppearanceMode(data.groups.appearance.mode);
  const accent = normalizeAppearanceAccent(data.groups.appearance.accent);
  useEffect(() => {
    applyAppearanceAccent(document.documentElement, accent);
  }, [accent]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const focused = document.activeElement;
      void applyThemeWithTransition(resolveAppearanceTheme(mode, media.matches), {
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
  }, [mode]);
  return null;
}
