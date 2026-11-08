export const MIN_PANEL_WIDTH = 280;
export const MIN_CHAT_WIDTH = 360;
export const SPLIT_HANDLE_WIDTH = 20;
export const OVERLAY_VIEWPORT_WIDTH = 900;

function minimumMainWidth(mainMinimum: number) {
  return Number.isFinite(mainMinimum) && mainMinimum >= 0 ? mainMinimum : MIN_CHAT_WIDTH;
}

export function workspaceUsesOverlay(containerWidth: number, viewportWidth: number, mainMinimum = MIN_CHAT_WIDTH): boolean {
  return (viewportWidth > 0 && viewportWidth <= OVERLAY_VIEWPORT_WIDTH) ||
    (containerWidth > 0 && containerWidth < minimumMainWidth(mainMinimum) + MIN_PANEL_WIDTH + SPLIT_HANDLE_WIDTH);
}

export function panelWidthLimits(containerWidth: number, mainMinimum = MIN_CHAT_WIDTH) {
  const width = Number.isFinite(containerWidth) ? containerWidth : 0;
  return { min: MIN_PANEL_WIDTH, max: Math.max(MIN_PANEL_WIDTH, width - minimumMainWidth(mainMinimum) - SPLIT_HANDLE_WIDTH) };
}

/** Keep the preferred width separate, so a temporary narrow window cannot erase it. */
export function fitPanelWidth(containerWidth: number, preferred: number | null, mainMinimum = MIN_CHAT_WIDTH): number {
  const limits = panelWidthLimits(containerWidth, mainMinimum);
  const requested = preferred !== null && Number.isFinite(preferred) ? preferred : containerWidth * 0.4;
  return Math.min(limits.max, Math.max(limits.min, requested));
}
