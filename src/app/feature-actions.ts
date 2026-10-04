import { featureById, featureCatalog, maxPinnedFeatures } from "./feature-model";
import { icon } from "./icons";
import { renderFeaturePreset } from "./feature-view";
import type { WorkspaceStore } from "./state";
import type { ShellOverlays } from "./overlays";

interface FeatureHost {
  render: (focus?: string) => void;
  continueCompanion: () => void;
  chooseCompanion: () => void;
  showActivity: () => void;
}

export class FeatureActions {
  constructor(private root: HTMLElement, private store: WorkspaceStore, private overlays: ShellOverlays, private host: FeatureHost) {}

  menu(anchor: HTMLElement): void {
    const bounds = anchor.getBoundingClientRect();
    this.overlays.menu(anchor, featureCatalog.map((feature, index) => {
      const pinned = this.store.state.pinnedFeatures.includes(feature.id);
      const limited = !pinned && this.store.state.pinnedFeatures.length >= maxPinnedFeatures;
      return {
        label: feature.title, icon: feature.icon, separatorBefore: index > 0 && feature.category !== featureCatalog[index - 1].category,
        pin: { label: limited ? `最多固定 ${maxPinnedFeatures} 个功能，请先取消一个` : `${pinned ? "取消固定" : "固定"}${feature.title}`, pressed: pinned, disabled: limited, run: () => {
          if (!this.store.toggleFeaturePin(feature.id)) return;
          this.host.render("feature-menu");
          const next = this.root.querySelector<HTMLElement>('[data-focus="feature-menu"]');
          if (next) {
            this.menu(next);
            this.overlays.overlay?.querySelector<HTMLElement>(`[data-menu-pin="${index}"]`)?.focus();
          }
        } },
        run: () => this.open(feature.id),
      };
    }), "更多功能", "", { point: { x: bounds.right + 8, y: bounds.top - 2 }, className: "feature-menu", header: '<div class="feature-menu-heading"><span>更多功能</span><small>固定常用入口</small></div>' });
  }

  open(id: string): void {
    const feature = featureById(id);
    if (!feature) return;
    const dialog = this.overlays.dialog(renderFeaturePreset(feature, this.store), "feature-dialog");
    const pinButton = dialog.querySelector<HTMLButtonElement>('[data-feature-action="pin"]')!;
    const updatePin = () => {
      const pinned = this.store.state.pinnedFeatures.includes(feature.id);
      pinButton.disabled = !pinned && this.store.state.pinnedFeatures.length >= maxPinnedFeatures;
      pinButton.innerHTML = `${icon("pin", "", pinned ? "active" : "outline")}<span>${pinned ? "取消固定" : "固定到侧栏"}</span>`;
      pinButton.title = pinButton.disabled ? `最多固定 ${maxPinnedFeatures} 个功能，请先取消一个` : "";
      pinButton.setAttribute("aria-pressed", String(pinned));
    };
    updatePin();
    dialog.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("[data-feature-action]");
      if (!button || button.disabled) return;
      if (button.dataset.featureAction === "pin") {
        if (this.store.toggleFeaturePin(feature.id)) { this.host.render(`feature-${feature.id}`); updatePin(); }
      } else {
        this.overlays.close(false);
        if (button.dataset.featureAction === "continue") this.host.continueCompanion();
        if (button.dataset.featureAction === "choose") this.host.chooseCompanion();
        if (button.dataset.featureAction === "activity") this.host.showActivity();
      }
    });
  }
}
