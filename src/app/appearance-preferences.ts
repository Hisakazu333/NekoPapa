export const APPEARANCE_MODES = ["system", "light", "dark"] as const;
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export const APPEARANCE_ACCENTS = [
  { id: "pink", label: "粉色", swatchClass: "bg-appearance-accent-pink" },
  { id: "green", label: "鼠尾草绿", swatchClass: "bg-appearance-accent-green" },
  { id: "blue", label: "蓝色", swatchClass: "bg-appearance-accent-blue" },
  { id: "purple", label: "紫色", swatchClass: "bg-appearance-accent-purple" },
  { id: "orange", label: "暖橙色", swatchClass: "bg-appearance-accent-orange" },
] as const;

export type NamedAppearanceAccent = (typeof APPEARANCE_ACCENTS)[number]["id"];
/** "theme" follows the colour theme's accent (the default theme's is pink). */
export type AppearanceAccent = NamedAppearanceAccent | "theme" | `#${string}`;
export type ResolvedAppearanceTheme = "light" | "dark";

const appearanceAccentIds = new Set<string>(APPEARANCE_ACCENTS.map(({ id }) => id));

export function normalizeAppearanceMode(value: unknown): AppearanceMode {
  return APPEARANCE_MODES.includes(value as AppearanceMode) ? value as AppearanceMode : "system";
}

export function normalizeAppearanceAccent(value: unknown): AppearanceAccent {
  if (typeof value !== "string") return "pink";
  if (appearanceAccentIds.has(value) || value === "theme") return value as AppearanceAccent;
  return /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() as AppearanceAccent : "pink";
}

export function resolveAppearanceTheme(
  mode: unknown,
  systemDark: boolean,
): ResolvedAppearanceTheme {
  const normalizedMode = normalizeAppearanceMode(mode);
  return normalizedMode === "dark" || (normalizedMode === "system" && systemDark)
    ? "dark"
    : "light";
}

export interface AppearanceRoot {
  dataset: { accent?: string };
  style?: { setProperty(name: string, value: string): void; removeProperty(name: string): void };
}

const CUSTOM_RAMP_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const CUSTOM_ACCENT_RAMP = [
  ["white", 94], ["white", 86], ["white", 72], ["white", 54], ["white", 32],
  ["black", 12], ["black", 24], ["black", 38], ["black", 52], ["black", 66], ["black", 78],
] as const;
function setCustomAccentRamp(root: AppearanceRoot, hex: string) {
  for (const [index, shade] of CUSTOM_RAMP_SHADES.entries()) {
    const [mixColor, amount] = CUSTOM_ACCENT_RAMP[index];
    root.style?.setProperty(`--color-accent-${shade}`, `color-mix(in oklab, ${mixColor} ${amount}%, ${hex})`);
  }
  root.style?.setProperty("--accent", "var(--color-accent-600)");
  root.style?.setProperty("--accent-soft", "var(--color-accent-100)");
  root.style?.setProperty("--focus-color", "var(--color-accent-500)");
}

function clearCustomAccentRamp(root: AppearanceRoot) {
  for (const shade of CUSTOM_RAMP_SHADES) root.style?.removeProperty(`--color-accent-${shade}`);
  root.style?.removeProperty("--accent");
  root.style?.removeProperty("--accent-soft");
  root.style?.removeProperty("--focus-color");
}

/** `themeAccent` is the colour theme's accent, used when the accent is "theme". */
export function applyAppearanceAccent(root: AppearanceRoot, accent: unknown, themeAccent = ""): AppearanceAccent {
  const chosen = normalizeAppearanceAccent(accent);
  const normalizedAccent = chosen === "theme" ? normalizeAppearanceAccent(themeAccent || "pink") : chosen;
  if (normalizedAccent.startsWith("#")) {
    root.dataset.accent = "custom";
    setCustomAccentRamp(root, normalizedAccent);
  } else {
    root.dataset.accent = normalizedAccent;
    clearCustomAccentRamp(root);
  }
  return normalizedAccent;
}
