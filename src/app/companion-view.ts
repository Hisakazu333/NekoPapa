import { companionById, conversationForCompanion } from "./companion-model";
import type { CompanionDefinition } from "./companion-model";
import type { WorkspaceStore } from "./state";
import { escapeHtml } from "./view-shared";
import { icon } from "./icons";

export function renderCompanionAvatar(companion: CompanionDefinition): string {
  return `<span class="companion-avatar avatar-${companion.id}" aria-hidden="true">${companion.avatar ? `<img src="${companion.avatar}" alt="" width="48" height="48" draggable="false" />` : `<span>${escapeHtml(companion.name.slice(-1))}</span>`}</span>`;
}

export function renderCompanionEntry(store: WorkspaceStore): string {
  const companion = companionById(store.state.selectedCompanionId)!;
  const conversation = conversationForCompanion(store.state);
  const label = conversation ? "继续对话" : "开始对话";
  return `<div class="companion-entry">
    <button class="companion-select" type="button" data-action="companion-menu" data-focus="companion-selector" aria-label="切换陪伴角色，当前${companion.name}" aria-haspopup="menu" title="切换陪伴角色">
      ${renderCompanionAvatar(companion)}<span class="companion-name">${companion.name}</span>${icon("down")}
    </button>
    <button class="companion-continue" type="button" data-action="companion" data-focus="companion-continue" aria-label="${label}，${companion.name}" title="${conversation ? `继续「${escapeHtml(conversation.title)}」` : `开始与${companion.name}的对话`}">${label}</button>
  </div>`;
}
