import { icon } from "./icons";
import { companionCatalog, companionName } from "./companion-model";
import { renderCompanionAvatar } from "./companion-view";
import { featureCatalog, maxPinnedFeatures } from "./feature-model";
import { sidebarListLimits } from "./sidebar-query";
import type { WorkspaceStore } from "./state";

function row(title: string, description: string, control: string): string {
  return `<div class="settings-option"><div class="settings-option-copy"><span>${title}</span><p>${description}</p></div><div class="settings-option-control">${control}</div></div>`;
}

export function generalSettings(store: WorkspaceStore): string {
  const state = store.state;
  return `<section class="settings-block" aria-labelledby="settings-navigation-title"><h2 id="settings-navigation-title">侧栏与导航</h2><div class="settings-option-group">
    ${row("显示内容侧栏", "返回工作台时，保留或收起内容侧栏。", `<label class="settings-switch"><input type="checkbox" data-preference="sidebar-visible" data-focus="preference-sidebar-visible" aria-label="显示内容侧栏" ${state.sidebarVisible ? "checked" : ""} /><span aria-hidden="true"></span></label>`)}
    ${row("侧栏宽度", "调整工作台内容侧栏的宽度。", `<div class="settings-width-control"><input type="range" min="196" max="320" step="1" value="${Math.round(state.sidebarWidth)}" data-preference="sidebar-width" data-focus="preference-sidebar-width" aria-label="侧栏宽度" /><output data-width-output>${Math.round(state.sidebarWidth)} px</output><button class="settings-small-button" type="button" data-settings-action="reset-width" data-focus="settings-reset-width">恢复默认</button></div>`)}
    ${row("每组显示数量", "控制列表密度，当前打开的内容始终可见。", `<select class="settings-select" data-preference="list-limit" data-focus="preference-list-limit" aria-label="每组显示数量">${sidebarListLimits.map((limit) => `<option value="${limit}" ${limit === state.sidebarPreferences.listLimit ? "selected" : ""}>${limit ? `${limit} 项` : "全部"}</option>`).join("")}</select>`)}
    ${row("对话列表范围", "只影响查找范围，保留当前对话。", `<select class="settings-select" data-preference="conversation-scope" data-focus="preference-conversation-scope" aria-label="对话列表范围"><option value="all" ${state.sidebarPreferences.conversationScope === "all" ? "selected" : ""}>全部角色</option><option value="selected" ${state.sidebarPreferences.conversationScope === "selected" ? "selected" : ""}>仅${companionName(state.selectedCompanionId)}</option></select>`)}
    ${row("导航顺序", "外侧分类支持拖动排序，可恢复初始排列。", '<button class="settings-small-button" type="button" data-settings-action="reset-order" data-focus="settings-reset-order">恢复默认顺序</button>')}
  </div></section><section class="settings-block" aria-labelledby="settings-features-title"><h2 id="settings-features-title">快捷入口</h2><p class="settings-block-description">选择固定在外栏的功能，最多 ${maxPinnedFeatures} 个。固定入口不启用尚未接入的能力。</p><div class="settings-option-group">${featureCatalog.map((feature) => {
    const checked = state.pinnedFeatures.includes(feature.id);
    return row(`${icon(feature.icon)}${feature.title}`, feature.description, `<label class="settings-switch"><input type="checkbox" data-preference="feature:${feature.id}" data-focus="preference-feature-${feature.id}" aria-label="固定${feature.title}" ${checked ? "checked" : state.pinnedFeatures.length >= maxPinnedFeatures ? "disabled" : ""} /><span aria-hidden="true"></span></label>`);
  }).join("")}</div></section>`;
}

export function characterSettings(store: WorkspaceStore): string {
  return `<section class="settings-block"><h2>当前陪伴角色</h2><p class="settings-block-description">新对话使用所选角色，已有会话保留原人物。</p><div class="settings-character-list" role="radiogroup" aria-label="选择陪伴角色">${companionCatalog.map((companion) => `<label class="settings-character-row">${renderCompanionAvatar(companion)}<span><strong>${companion.name}</strong><small>${companion.description}${companion.avatar ? "" : " · 头像待更新"}</small></span><input type="radio" name="settings-companion" value="${companion.id}" data-preference="companion" data-focus="preference-companion-${companion.id}" aria-label="${companion.name}" ${companion.id === store.state.selectedCompanionId ? "checked" : ""} /></label>`).join("")}</div></section>`;
}

