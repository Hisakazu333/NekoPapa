import type { WorkspaceStore } from "./state";
import type { ShellOverlays } from "./overlays";
import { SettingsNavigation, searchSettings } from "./settings-model";
import type { SettingsSection } from "./settings-model";
import { renderSettingsNavigation } from "./settings-view";
import { applySettingsPreference } from "./settings-preferences";
import type { CollectionKind } from "./lifecycle-view";
import { ConfigurationActions } from "./configuration-actions";

interface SettingsHost {
  render(focus?: string): void;
  clearNotice(): void;
  preferencesChanged(): void;
  bindCollection(element: HTMLElement, collection: CollectionKind): void;
}

export class SettingsActions {
  readonly navigation = new SettingsNavigation();
  readonly configuration: ConfigurationActions;
  private returnFocus?: string;
  private message = "";
  private scrollPositions = new Map<string, number>();
  constructor(private root: HTMLElement, private store: WorkspaceStore, private overlays: ShellOverlays, private host: SettingsHost) {
    this.configuration = new ConfigurationActions(root, store, overlays, { render: host.render, feedback: (message) => this.feedback(message) });
    root.addEventListener("click", (event) => this.click(event));
    root.addEventListener("change", (event) => this.change(event));
    root.addEventListener("input", (event) => this.input(event));
  }

  show(section: SettingsSection = "general", focus?: string): void {
    if (!this.navigation.open) this.returnFocus = (document.activeElement as HTMLElement | null)?.dataset.focus;
    this.overlays.close(false);
    this.host.clearNotice();
    this.message = "";
    this.navigation.enter(section);
    this.host.render(focus ?? `settings-section-${section}`);
  }

  close(focus = this.returnFocus): void {
    this.overlays.close(false);
    this.navigation.close();
    this.host.render(focus ?? `tab-${this.store.state.activeId}`);
  }

  bind(): void {
    if (!this.navigation.open) return;
    const workspace = this.root.querySelector<HTMLElement>(".settings-workspace");
    if (workspace) workspace.scrollTop = this.scrollPositions.get(this.navigation.section) ?? 0;
    const { section } = this.navigation;
    const collection = this.root.querySelector<HTMLElement>(".archive-content");
    if (collection && (section === "archive" || section === "trash")) this.host.bindCollection(collection, section);
    this.feedback(this.message);
  }

  capture(): void {
    const workspace = this.root.querySelector<HTMLElement>(".settings-workspace");
    if (workspace?.dataset.settingsPage) this.scrollPositions.set(workspace.dataset.settingsPage, workspace.scrollTop);
  }

  feedback(message: string): boolean {
    const status = this.root.querySelector<HTMLElement>("[data-settings-feedback]");
    if (!this.navigation.open || !status) return false;
    this.message = message;
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle("is-error", !this.store.storageAvailable || !this.configuration.store.storageAvailable);
    return true;
  }

  private save(name: string, value: string | boolean, focus?: string): void {
    if (!applySettingsPreference(this.store, name, value)) return;
    this.host.preferencesChanged();
    this.message = this.store.storageAvailable ? "已保存" : "保存失败，本次更改尚未落盘。";
    this.host.render(focus);
  }

  private click(event: MouseEvent): void {
    if (!this.navigation.open) return;
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-settings-section], [data-settings-action]");
    if (!button || button.disabled) return;
    const section = button.dataset.settingsSection;
    if (section) {
      if (this.navigation.select(section)) { this.message = ""; this.host.render(button.dataset.focus); }
      return;
    }
    switch (button.dataset.settingsAction) {
      case "close": this.close(); break;
      case "back": if (this.navigation.canBack) { this.message = ""; this.navigation.travel(-1); this.host.render("settings-history-back"); } else this.close(); break;
      case "forward": if (this.navigation.travel(1)) { this.message = ""; this.host.render("settings-history-forward"); } break;
      case "clear-search": this.navigation.query = ""; this.host.render("settings-search"); break;
      case "reset-width": this.save("sidebar-width", "232", button.dataset.focus); break;
      case "reset-order": this.save("reset-order", "", button.dataset.focus); break;
      case "retry-save": this.store.persist(); this.message = this.store.storageAvailable ? "已保存" : "仍无法保存，请检查本机存储后重试。"; this.host.render("settings-heading"); break;
    }
  }

  private change(event: Event): void {
    const control = event.target;
    if (!this.navigation.open || !(control instanceof HTMLInputElement || control instanceof HTMLSelectElement) || !control.dataset.preference) return;
    const value = control instanceof HTMLInputElement && control.type === "checkbox" ? control.checked : control.value;
    this.save(control.dataset.preference, value, control.dataset.focus);
  }

  private input(event: Event): void {
    const input = event.target;
    if (!this.navigation.open || !(input instanceof HTMLInputElement)) return;
    if (input.hasAttribute("data-settings-search")) {
      this.navigation.query = input.value;
      this.root.querySelector(".settings-navigation")!.innerHTML = renderSettingsNavigation(this.store, this.navigation);
    } else if (input.dataset.preference === "sidebar-width") {
      this.root.querySelector("[data-width-output]")!.textContent = `${input.value} px`;
    }
  }

  keydown(event: KeyboardEvent): boolean {
    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (modifier && key === "," && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      if (!this.navigation.open) this.show();
      return true;
    }
    if (!this.navigation.open) return false;
    if (event.key === "Escape" || (modifier && key === "w")) { event.preventDefault(); this.close(); return true; }
    if (modifier && key === "k") { event.preventDefault(); this.root.querySelector<HTMLInputElement>("[data-settings-search]")?.focus(); return true; }
    const target = event.target as HTMLElement;
    if (target.hasAttribute("data-settings-search") && ["ArrowDown", "Enter"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Enter") {
        const result = searchSettings(this.navigation.query)[0];
        if (result) { this.message = ""; this.navigation.select(result.id); this.host.render(`settings-section-${result.id}`); }
      } else this.root.querySelector<HTMLElement>("[data-settings-section]")?.focus();
    } else if (target.hasAttribute("data-settings-section") && ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const buttons = [...this.root.querySelectorAll<HTMLButtonElement>("[data-settings-section]")];
      const index = buttons.indexOf(target as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    } else if (!target.matches("input, select, textarea") && event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "ArrowLeft" && !this.navigation.canBack) this.close();
      else if (this.navigation.travel(event.key === "ArrowLeft" ? -1 : 1)) { this.message = ""; this.host.render("settings-heading"); }
    }
    // Workspace shortcuts cannot create, close or select hidden content behind settings.
    return true;
  }
}
