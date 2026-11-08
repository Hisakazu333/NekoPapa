export const APPEARANCE_MODES = ["system", "light", "dark"] as const;
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export const APPEARANCE_ACCENTS = [
  { id: "green", label: "鼠尾草绿", swatchClass: "bg-appearance-accent-green" },
  { id: "blue", label: "蓝色", swatchClass: "bg-appearance-accent-blue" },
  { id: "purple", label: "紫色", swatchClass: "bg-appearance-accent-purple" },
  { id: "orange", label: "暖橙色", swatchClass: "bg-appearance-accent-orange" },
] as const;

export type AppearanceAccent = (typeof APPEARANCE_ACCENTS)[number]["id"];
export type ResolvedAppearanceTheme = "light" | "dark";

const appearanceAccentIds = new Set<string>(APPEARANCE_ACCENTS.map(({ id }) => id));

export function normalizeAppearanceMode(value: unknown): AppearanceMode {
  return APPEARANCE_MODES.includes(value as AppearanceMode) ? value as AppearanceMode : "system";
}

export function normalizeAppearanceAccent(value: unknown): AppearanceAccent {
  return typeof value === "string" && appearanceAccentIds.has(value)
    ? value as AppearanceAccent
    : "green";
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
}

export function applyAppearanceAccent(root: AppearanceRoot, accent: unknown): AppearanceAccent {
  const normalizedAccent = normalizeAppearanceAccent(accent);
  root.dataset.accent = normalizedAccent;
  return normalizedAccent;
}
