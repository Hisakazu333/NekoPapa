import { icon } from "./icons";
import type { IconName } from "./icons";
import type { WorkspaceItem } from "./state";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export const itemIcons: Record<WorkspaceItem["kind"], IconName> = {
  home: "home", overview: "layers", conversation: "message", coding: "code", page: "file", companion: "cat", memory: "book", workflow: "workflow", tasks: "clock", settings: "settings", connections: "link",
};

export function itemIcon(item: WorkspaceItem): IconName {
  if (item.id.startsWith("group:")) return "folder";
  return item.kind === "overview" ? ({ chat: "message", library: "layers", projects: "folder", tools: "tools" } as Record<string, IconName>)[item.id] ?? "layers" : itemIcons[item.kind];
}

export function iconButton(name: IconName, label: string, action: string, attributes = "", focus = action): string {
  return `<button class="icon-button" type="button" data-action="${action}" data-focus="${focus}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${attributes}>${icon(name)}</button>`;
}

