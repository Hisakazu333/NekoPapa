/**
 * How the built-in browser lays a page out in its area.
 *
 * "fit" uses the area as it is, at the chosen zoom. A device mode gives the
 * page that device's width: narrower devices get a centred column of exactly
 * that width; wider ones fill the area and are zoomed out so the page lays
 * out at the device width (page zoom changes the CSS viewport, as ⌘− does in
 * Safari). Only the width is emulated: the site still sees this desktop
 * browser, so pages that switch on the user agent will not change.
 */
export type BrowserDevice = "fit" | "phone" | "tablet" | "laptop" | "desktop";

export interface BrowserDisplay { device: BrowserDevice; zoom: number }

export const defaultBrowserDisplay: BrowserDisplay = { device: "fit", zoom: 1 };

export const browserDevices: readonly { id: BrowserDevice; label: string; width?: number }[] = [
  { id: "fit", label: "适应区域" },
  { id: "phone", label: "手机", width: 390 },
  { id: "tablet", label: "平板", width: 820 },
  { id: "laptop", label: "笔记本", width: 1280 },
  { id: "desktop", label: "台式机", width: 1600 },
];

export const browserZoomSteps = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5] as const;

export interface BrowserFrame {
  /** Offset of the native view inside the area, to centre a narrow device. */
  x: number;
  width: number;
  height: number;
  zoom: number;
  /** The CSS width the page lays out at. */
  layoutWidth: number;
}

const clampZoom = (zoom: number) => Math.min(3, Math.max(0.25, Number.isFinite(zoom) ? zoom : 1));

export function browserFrame(area: { width: number; height: number }, display: BrowserDisplay): BrowserFrame {
  const width = Math.max(1, Math.round(area.width));
  const height = Math.max(1, Math.round(area.height));
  const device = browserDevices.find((entry) => entry.id === display.device)?.width;
  if (!device) {
    const zoom = clampZoom(display.zoom);
    return { x: 0, width, height, zoom, layoutWidth: Math.round(width / zoom) };
  }
  if (device <= width) return { x: Math.floor((width - device) / 2), width: device, height, zoom: 1, layoutWidth: device };
  const zoom = Math.round((width / device) * 1000) / 1000;
  return { x: 0, width, height, zoom, layoutWidth: device };
}

/** One step smaller or larger than `zoom` on the menu's scale. */
export function stepBrowserZoom(zoom: number, direction: -1 | 1): number {
  const steps = [...browserZoomSteps];
  if (direction > 0) return steps.find((step) => step > zoom + 0.001) ?? steps[steps.length - 1];
  return [...steps].reverse().find((step) => step < zoom - 0.001) ?? steps[0];
}

export const formatBrowserZoom = (zoom: number) => `${Math.round(zoom * 100)}%`;
