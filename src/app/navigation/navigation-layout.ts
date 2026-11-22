export type NavigationLayout = "sidebar" | "dock";
export const normalizeNavigationLayout = (value: unknown): NavigationLayout => value === "dock" ? "dock" : "sidebar";
