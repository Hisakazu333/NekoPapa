import { companionName } from "./companion-model";
import { sidebarListLimits } from "./sidebar-query";
import type { SidebarPreferences } from "./sidebar-query";
import type { WorkspaceStore } from "./state";
import type { MenuEntry, ShellOverlays } from "./overlays";

// Expanded list previews are window presentation; only list preferences are saved.
export class SidebarActions {
  readonly expandedLists = new Set<string>();
  constructor(private store: WorkspaceStore, private overlays: ShellOverlays, private render: (focus?: string) => void) {}

  toggleList(id: string): void {
    if (!id) return;
    if (this.expandedLists.has(id)) this.expandedLists.delete(id);
    else this.expandedLists.add(id);
    this.render(`list-${id}`);
  }

  private update(update: Partial<SidebarPreferences>, focus: string): void {
    if (!this.store.setSidebarPreferences(update)) return;
    this.expandedLists.clear();
    this.render(focus);
  }

  densityEntry(focus = "sidebar-options"): MenuEntry {
    const limit = this.store.state.sidebarPreferences.listLimit;
    return {
      label: "每组显示数量", description: limit ? `${limit} 项` : "全部", icon: "layers", run: () => {},
      submenu: sidebarListLimits.map((value) => ({
        label: value ? `${value} 项` : "全部", selected: value === limit,
        run: () => this.update({ listLimit: value }, focus),
      })),
    };
  }

  menu(anchor: HTMLElement): void {
    const { navigationMode: mode, sidebarPreferences, selectedCompanionId } = this.store.state;
    const entries: MenuEntry[] = mode === "chat" ? [
      { label: "全部人物的对话", selected: sidebarPreferences.conversationScope === "all", icon: "message", run: () => this.update({ conversationScope: "all" }, "sidebar-options") },
      { label: `仅${companionName(selectedCompanionId)}`, selected: sidebarPreferences.conversationScope === "selected", icon: "user", run: () => this.update({ conversationScope: "selected" }, "sidebar-options") },
      { ...this.densityEntry(), separatorBefore: true },
    ] : [this.densityEntry()];
    this.overlays.menu(anchor, entries, "侧栏列表");
  }

  showAllConversations(): void { this.update({ conversationScope: "all" }, "sidebar-options"); }
}
