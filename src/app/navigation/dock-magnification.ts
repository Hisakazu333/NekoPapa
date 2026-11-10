/**
 * 底部悬浮栏的悬停放大（类似 macOS 程序坞）：图标越靠近指针越大，超出
 * `reach` 不放大。返回尺寸倍数，1 表示原尺寸。余弦曲线让放大平滑衰减，
 * 相邻图标随尺寸变化被推开，而不是互相重叠。
 */
export const DOCK_TILE_SIZE = 40;
export const DOCK_MAX_SCALE = 1.5;
export const DOCK_REACH = 110;

export function dockScale(distance: number, reach = DOCK_REACH, max = DOCK_MAX_SCALE): number {
  const offset = Math.abs(distance);
  if (!Number.isFinite(offset) || offset >= reach) return 1;
  return 1 + (max - 1) * (Math.cos((offset / reach) * Math.PI) + 1) / 2;
}

export type NavigationLayout = "sidebar" | "dock";
export const normalizeNavigationLayout = (value: unknown): NavigationLayout => value === "dock" ? "dock" : "sidebar";
