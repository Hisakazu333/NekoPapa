/**
 * Colour themes for 设置 → 外观. Every semantic token (text, background,
 * border, icon) is defined on the neutral ramp, so a theme only rebuilds that
 * ramp between its background and foreground, and supplies an accent. The
 * presets are published open-source editor palettes; each lists the modes it
 * has. A custom background / foreground per mode overrides the preset.
 */

export type ThemeMode = "light" | "dark";
export interface ThemeColors { background: string; foreground: string; accent: string }
export interface AppearanceTheme { id: string; label: string; light?: ThemeColors; dark?: ThemeColors }

export const DEFAULT_THEME_ID = "default";

export const APPEARANCE_THEMES: readonly AppearanceTheme[] = [
  { id: DEFAULT_THEME_ID, label: "NekoPapa" },
  { id: "catppuccin", label: "Catppuccin",
    light: { background: "#eff1f5", foreground: "#4c4f69", accent: "#8839ef" },
    dark: { background: "#1e1e2e", foreground: "#cdd6f4", accent: "#cba6f7" } },
  { id: "dracula", label: "Dracula",
    dark: { background: "#282a36", foreground: "#f8f8f2", accent: "#bd93f9" } },
  { id: "gruvbox", label: "Gruvbox",
    light: { background: "#fbf1c7", foreground: "#3c3836", accent: "#af3a03" },
    dark: { background: "#282828", foreground: "#ebdbb2", accent: "#fe8019" } },
  { id: "nord", label: "Nord",
    light: { background: "#eceff4", foreground: "#2e3440", accent: "#5e81ac" },
    dark: { background: "#2e3440", foreground: "#eceff4", accent: "#88c0d0" } },
  { id: "ayu", label: "Ayu",
    light: { background: "#fcfcfc", foreground: "#5c6166", accent: "#fa8d3e" },
    dark: { background: "#1f2430", foreground: "#cccac2", accent: "#ffcc66" } },
  { id: "everforest", label: "Everforest",
    light: { background: "#fdf6e3", foreground: "#5c6a72", accent: "#8da101" },
    dark: { background: "#2d353b", foreground: "#d3c6aa", accent: "#a7c080" } },
  { id: "solarized", label: "Solarized",
    light: { background: "#fdf6e3", foreground: "#586e75", accent: "#268bd2" },
    dark: { background: "#002b36", foreground: "#93a1a1", accent: "#268bd2" } },
  { id: "one", label: "One",
    light: { background: "#fafafa", foreground: "#383a42", accent: "#4078f2" },
    dark: { background: "#282c34", foreground: "#abb2bf", accent: "#61afef" } },
  { id: "tokyo-night", label: "Tokyo Night",
    light: { background: "#e1e2e7", foreground: "#3760bf", accent: "#2e7de9" },
    dark: { background: "#1a1b26", foreground: "#c0caf5", accent: "#7aa2f7" } },
  { id: "rose-pine", label: "Rosé Pine",
    light: { background: "#faf4ed", foreground: "#575279", accent: "#907aa9" },
    dark: { background: "#191724", foreground: "#e0def4", accent: "#c4a7e7" } },
  { id: "kanagawa", label: "Kanagawa",
    light: { background: "#f2ecbc", foreground: "#545464", accent: "#4d699b" },
    dark: { background: "#1f1f28", foreground: "#dcd7ba", accent: "#7e9cd8" } },
  { id: "night-owl", label: "Night Owl",
    light: { background: "#fbfbfb", foreground: "#403f53", accent: "#4876d6" },
    dark: { background: "#011627", foreground: "#d6deeb", accent: "#82aaff" } },
  { id: "material", label: "Material",
    light: { background: "#fafafa", foreground: "#546e7a", accent: "#39adb5" },
    dark: { background: "#263238", foreground: "#eeffff", accent: "#80cbc4" } },
  { id: "tomorrow", label: "Tomorrow",
    light: { background: "#ffffff", foreground: "#4d4d4c", accent: "#4271ae" },
    dark: { background: "#1d1f21", foreground: "#c5c8c6", accent: "#81a2be" } },
  { id: "vitesse", label: "Vitesse",
    light: { background: "#ffffff", foreground: "#393a34", accent: "#1c6b48" },
    dark: { background: "#121212", foreground: "#dbd7ca", accent: "#4d9375" } },
  { id: "oxocarbon", label: "Oxocarbon",
    light: { background: "#ffffff", foreground: "#393939", accent: "#0f62fe" },
    dark: { background: "#161616", foreground: "#f2f4f8", accent: "#78a9ff" } },
  { id: "monokai", label: "Monokai",
    dark: { background: "#272822", foreground: "#f8f8f2", accent: "#a6e22e" } },
  { id: "poimandres", label: "Poimandres",
    dark: { background: "#1b1e28", foreground: "#a6accd", accent: "#add7ff" } },
];

export const themeById = (id: unknown) => APPEARANCE_THEMES.find((theme) => theme.id === id) ?? APPEARANCE_THEMES[0];
export const normalizeThemeId = (id: unknown) => themeById(id).id;

const HEX = /^#[\da-f]{6}$/i;
/** "" (follow the theme) or a six-digit HEX colour, lower case. */
export function normalizeThemeColor(value: unknown): string {
  return typeof value === "string" && HEX.test(value) ? value.toLowerCase() : "";
}

/** The configuration keys holding the custom colours for a mode. */
export const themeColorKeys = (mode: ThemeMode) => mode === "dark"
  ? { background: "backgroundDark", foreground: "foregroundDark" } as const
  : { background: "backgroundLight", foreground: "foregroundLight" } as const;

/** WCAG relative luminance of a HEX colour. */
export function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Where each neutral shade sits between the lightest (0) and darkest (1)
 * ends, taken from the default ramp's lightness so themed surfaces keep the
 * same steps between panels, borders and text.
 */
export const NEUTRAL_STEPS: readonly (readonly [shade: number, position: number])[] = [
  [50, 0], [100, 0.02], [200, 0.075], [300, 0.14], [400, 0.33], [500, 0.51],
  [600, 0.65], [700, 0.73], [800, 0.85], [900, 0.93], [925, 0.96], [950, 1],
];

/** The resolved colours for a mode, or undefined when the default ramp applies. */
export function resolveThemeColors(values: Record<string, unknown>, mode: ThemeMode): ThemeColors | undefined {
  const preset = themeById(values.theme)[mode];
  const keys = themeColorKeys(mode);
  const background = normalizeThemeColor(values[keys.background]) || preset?.background;
  const foreground = normalizeThemeColor(values[keys.foreground]) || preset?.foreground;
  if (!background || !foreground) return undefined;
  return { background, foreground, accent: preset?.accent ?? "" };
}

/** The ramp as CSS declarations: shade → color-mix() between the two ends. */
export function neutralRamp(colors: Pick<ThemeColors, "background" | "foreground">): [name: string, value: string][] {
  const [light, dark] = luminance(colors.background) >= luminance(colors.foreground)
    ? [colors.background, colors.foreground] : [colors.foreground, colors.background];
  return NEUTRAL_STEPS.map(([shade, position]) => [
    `--color-neutral-${shade}`,
    position === 0 ? light : position === 1 ? dark : `color-mix(in oklab, ${dark} ${Math.round(position * 1000) / 10}%, ${light})`,
  ]);
}

interface StyleRoot { dataset: { colorTheme?: string }; style?: { setProperty(name: string, value: string): void; removeProperty(name: string): void } }

/** Applies or clears the themed ramp on the document root. */
export function applyThemeColors(root: StyleRoot, colors: ThemeColors | undefined, themeId: string) {
  if (!colors) {
    for (const [shade] of NEUTRAL_STEPS) root.style?.removeProperty(`--color-neutral-${shade}`);
    root.style?.removeProperty("--color-white");
    delete root.dataset.colorTheme;
    return;
  }
  for (const [name, value] of neutralRamp(colors)) root.style?.setProperty(name, value);
  // Light mode paints its main surfaces (window, cards, inputs) in plain
  // white rather than a neutral shade, so a light theme's paper replaces it.
  if (luminance(colors.background) >= luminance(colors.foreground)) root.style?.setProperty("--color-white", colors.background);
  else root.style?.removeProperty("--color-white");
  root.dataset.colorTheme = themeId;
}
