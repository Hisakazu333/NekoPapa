import { renderFeatureRail } from "./feature-view";
import { navigationLabels } from "./sidebar-view";
import { icon } from "./icons";
import type { IconName } from "./icons";
import type { WorkspaceStore, NavigationMode } from "./state";

export function renderGlobalRail(store: WorkspaceStore, settings = false): string {
  const state = store.state;
  const railIcons: Record<NavigationMode, IconName> = { home: "home", chat: "message", library: "layers", tasks: "clock", tools: "tools", projects: "code" };
  return `<nav class="icon-rail" aria-label="全局导航">
    <div class="rail-top">
      ${state.railOrder.filter((id) => id !== "tasks" && id !== "tools").map((id) => {
        const selected = !settings && state.navigationMode === id;
        return `<button class="rail-button ${selected ? "is-selected" : ""}" type="button" data-action="navigate" data-id="${id}" data-focus="rail-${id}" ${settings ? "" : `data-drag-kind="rail" data-drag-id="${id}"`} aria-label="${navigationLabels[id]}" aria-pressed="${selected}" title="${navigationLabels[id]}${settings ? "" : " · 拖动排序"}">${icon(railIcons[id], "", selected ? "active" : "outline")}</button>`;
      }).join("")}
      ${renderFeatureRail(store)}
    </div>
    <div class="rail-bottom">
      <button class="rail-button" type="button" data-action="navigation-settings" data-focus="navigation-settings" aria-label="侧栏布局" aria-haspopup="menu" title="侧栏布局">${icon("layout")}</button>
      <button class="profile-button" type="button" data-action="account-menu" data-focus="rail-account" aria-label="账号，未登录" aria-haspopup="menu" aria-expanded="false" title="账号 · 未登录">${icon("user")}</button>
    </div>
  </nav>`;
}
