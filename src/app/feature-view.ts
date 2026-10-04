import { featureById } from "./feature-model";
import type { FeatureDefinition } from "./feature-model";
import { icon } from "./icons";
import { escapeHtml, iconButton } from "./view-shared";
import type { WorkspaceStore } from "./state";
import { companionById, conversationForCompanion } from "./companion-model";
import { renderCompanionAvatar } from "./companion-view";

export function renderFeatureRail(store: WorkspaceStore): string {
  return `<button class="rail-button" type="button" data-action="feature-menu" data-focus="feature-menu" aria-label="更多功能" aria-haspopup="menu" title="更多功能">${icon("more")}</button>
    ${store.state.pinnedFeatures.length ? `<span class="rail-feature-divider" aria-hidden="true"></span><div class="rail-features" role="group" aria-label="固定的功能">${store.state.pinnedFeatures.map((id) => {
      const feature = featureById(id)!;
      return `<button class="rail-button" type="button" data-action="feature-open" data-id="${id}" data-focus="feature-${id}" aria-label="${feature.title}" aria-haspopup="dialog" title="${feature.title} · ${feature.status}">${icon(feature.icon)}</button>`;
    }).join("")}</div>` : ""}`;
}

export function renderFeaturePreset(feature: FeatureDefinition, store: WorkspaceStore): string {
  const companion = companionById(store.state.selectedCompanionId)!;
  const hasConversation = !!conversationForCompanion(store.state);
  return `<div class="feature-dialog-heading"><span class="feature-category">${feature.category}</span>${iconButton("close", "关闭功能预设", "dismiss", "data-dismiss")}</div>
    <h2 class="feature-title" id="dialog-title">${icon(feature.icon)}${feature.title}<span class="feature-status">${feature.status}</span></h2>
    <p class="feature-description">${escapeHtml(feature.description)}</p>
    ${feature.id === "characters" ? `<div class="feature-character">${renderCompanionAvatar(companion)}<div class="feature-character-identity"><strong>${companion.name}</strong><span>当前陪伴角色</span></div><button type="button" class="text-button" data-feature-action="choose">切换角色</button><button type="button" class="text-button" data-feature-action="continue">${hasConversation ? "继续对话" : "开始对话"}</button></div>` : '<p class="feature-preset-note">功能预设 · 可固定入口，实际能力尚未接入</p>'}
    <ul class="feature-capabilities">${feature.capabilities.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul>
    <div class="feature-dialog-footer"><button type="button" class="feature-pin-toggle text-button" data-feature-action="pin"></button>${feature.id === "agent-workspace" ? '<button type="button" class="text-button" data-feature-action="activity">查看会话活动</button>' : '<button type="button" class="text-button" data-dismiss>关闭</button>'}</div>`;
}
