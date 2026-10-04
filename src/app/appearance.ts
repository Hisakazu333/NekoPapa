import type { ConfigurationValues } from "./configuration-types";

const systemMode = window.matchMedia("(prefers-color-scheme: dark)");
let current: ConfigurationValues;
const fonts: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  serif: 'Georgia, "Songti SC", "SimSun", serif',
  mono: 'ui-monospace, "SFMono-Regular", "Menlo", "PingFang SC", monospace',
};

export function applyAppearance(values: ConfigurationValues): void {
  current = values;
  const root = document.documentElement;
  root.dataset.theme = values.mode === "system" ? systemMode.matches ? "dark" : "light" : String(values.mode);
  root.dataset.accent = String(values.accent);
  root.dataset.density = String(values.density);
  root.dataset.reducedMotion = String(values.reducedMotion);
  root.style.setProperty("--app-font", fonts[String(values.font)] ?? fonts.system);
}

systemMode.addEventListener("change", () => { if (current?.mode === "system") applyAppearance(current); });
