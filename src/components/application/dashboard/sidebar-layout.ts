export const SIDEBAR_COLLAPSED_WIDTH = 60;
export const SIDEBAR_DEFAULT_WIDTH = 280;
export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_COLLAPSE_THRESHOLD = 140;

/** Keep enough room for the contacts list and its conversation on desktop. */
export function sidebarMaximumWidth(containerWidth: number): number {
  const available = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth - 600 : 360;
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(360, available));
}

export function fitSidebarWidth(preferredWidth: number | null, maximum: number): number {
  const preferred = preferredWidth !== null && Number.isFinite(preferredWidth) ? preferredWidth : SIDEBAR_DEFAULT_WIDTH;
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(maximum, preferred));
}

export function sidebarResizeState(value: number, maximum: number): { collapsed: boolean; width: number } {
  if (value < SIDEBAR_COLLAPSE_THRESHOLD) return { collapsed: true, width: SIDEBAR_COLLAPSED_WIDTH };
  return { collapsed: false, width: fitSidebarWidth(value, maximum) };
}
