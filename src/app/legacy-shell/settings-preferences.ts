import type { WorkspaceStore } from "./state";
import { defaultRailOrder } from "./workspace-model";
import { featureById } from "./feature-model";
import { sidebarListLimits } from "./sidebar-query";
import type { SidebarListLimit } from "./sidebar-query";

// These controls delegate to the existing preference owners, never a settings copy.
export function applySettingsPreference(store: WorkspaceStore, name: string, value: string | boolean): boolean {
  if (name === "list-limit") {
    if (typeof value !== "string" || !value.trim()) return false;
    const limit = Number(value);
    return sidebarListLimits.includes(limit as SidebarListLimit) && store.setSidebarPreferences({ listLimit: limit as SidebarListLimit });
  }
  if (name === "conversation-scope") {
    return (value === "all" || value === "selected") && store.setSidebarPreferences({ conversationScope: value });
  }
  if (name === "companion" && typeof value === "string") return store.selectCompanion(value);
  if (name.startsWith("feature:")) {
    const feature = featureById(name.slice(8));
    return !!feature && typeof value === "boolean" && store.state.pinnedFeatures.includes(feature.id) !== value && store.toggleFeaturePin(feature.id);
  }
  if (name === "sidebar-visible" && typeof value === "boolean") {
    if (store.state.sidebarVisible === value) return false;
    store.state.sidebarVisible = value;
  } else if (name === "sidebar-width") {
    if (typeof value !== "string" || !value.trim()) return false;
    const width = Number(value);
    if (!Number.isFinite(width) || width < 196 || width > 320 || width === store.state.sidebarWidth) return false;
    store.state.sidebarWidth = width;
  } else if (name === "reset-order") {
    if (store.state.railOrder.every((id, index) => id === defaultRailOrder[index])) return false;
    store.state.railOrder = [...defaultRailOrder];
  } else return false;
  store.persist();
  return true;
}
