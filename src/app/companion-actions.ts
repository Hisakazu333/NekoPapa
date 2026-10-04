import { companionCatalog } from "./companion-model";
import { renderCompanionAvatar } from "./companion-view";
import type { WorkspaceStore } from "./state";
import type { ShellOverlays } from "./overlays";

export class CompanionActions {
  constructor(private store: WorkspaceStore, private overlays: ShellOverlays, private render: (focus?: string) => void) {}

  menu(anchor: HTMLElement): void {
    this.overlays.menu(anchor, companionCatalog.map((companion) => ({
      label: companion.name, description: companion.description,
      selected: companion.id === this.store.state.selectedCompanionId,
      status: companion.avatar ? undefined : "头像待更新",
      run: () => {
        if (this.store.selectCompanion(companion.id)) this.render(anchor.dataset.focus);
      },
    })), "陪伴角色", '<p class="companion-menu-note">已有对话保留原来的角色</p>', { className: "companion-menu" });
    this.overlays.overlay?.querySelectorAll<HTMLElement>(".menu-glyph").forEach((glyph, index) => {
      glyph.innerHTML = renderCompanionAvatar(companionCatalog[index]);
    });
  }
}
