/**
 * The computed value of a theme colour variable as sRGB channels. Tokens may
 * be oklch() or color-mix(), which neither canvas nor xterm read back in a
 * fixed format, so the colour is painted on a 1px canvas and sampled.
 */
export function tokenRgb(name: string): [number, number, number] | undefined {
  if (typeof document === "undefined") return undefined;
  const probe = document.createElement("span");
  probe.style.color = `var(--color-${name})`;
  probe.style.display = "none";
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !value) return undefined;
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

export const tokenCss = (name: string, fallback: string) => {
  const rgb = tokenRgb(name);
  return rgb ? `rgb(${rgb.join(", ")})` : fallback;
};

export const tokenHex = (name: string) => {
  const rgb = tokenRgb(name);
  return rgb && `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
};
