import type { StoredThread } from "@/components/application/agent-chat/thread-storage";
import type { ChatContact } from "@/app/contacts/contacts-store";

export type SidebarSearchTarget =
  | { type: "page"; key: string }
  | { type: "thread"; id: string }
  | { type: "contact"; id: string }
  | { type: "setting"; section: string };

export interface SidebarSearchEntry {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  keywords?: string;
  target: SidebarSearchTarget;
}

export function sidebarSearchOptionId(id: string) {
  return `sidebar-search-option-${encodeURIComponent(id)}`;
}

export function sidebarQuickSearchShortcut(platform: string) {
  return /mac|iphone|ipad/i.test(platform) ? "⌘L" : "Ctrl+K";
}

export function isSidebarQuickSearchShortcut(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "isComposing" | "repeat">,
  platform: string,
) {
  if (event.altKey || event.shiftKey || event.isComposing || event.repeat) return false;
  const key = event.key.toLocaleLowerCase();
  return /mac|iphone|ipad/i.test(platform)
    ? event.metaKey && (key === "l" || key === "k")
    : event.ctrlKey && key === "k";
}

interface SearchNavigation { key: string; label: string }
interface SearchSetting { id: string; label: string; title: string; description: string }

const settingsSearchAliases: Record<string, string> = {
  general: "general workspace preferences",
  profile: "profile local profile",
  appearance: "appearance theme color dark mode",
  model: "model models api provider",
  agent: "agent defaults",
  personalization: "personalization memory instructions",
  voice: "voice speech",
  tools: "tools skills mcp connectors",
  data: "data backup export import",
  computer: "computer control",
  history: "activity history",
  screenshots: "screenshots app snapshots",
  browser: "browser links annotations",
  connections: "devices ssh connections",
  coding: "coding development",
  hooks: "hooks lifecycle commands",
  review: "review code security",
  git: "git branches pull requests",
  worktrees: "worktrees git directories",
  shortcuts: "shortcuts keyboard",
  about: "about version",
};

function threadText(thread: StoredThread) {
  return thread.messages.map((message) => message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.type === "text" ? part.text : "").join(""))
    .filter((text) => text.trim()).join("\n");
}

export function buildSidebarSearchEntries({
  navigation, threads, contacts, settings,
}: {
  navigation: SearchNavigation[];
  threads: StoredThread[];
  contacts: ChatContact[];
  settings: SearchSetting[];
}): SidebarSearchEntry[] {
  const entries: SidebarSearchEntry[] = navigation.map((item) => ({
    id: `page:${item.key}`, group: "页面", title: item.label, subtitle: "打开页面",
    target: { type: "page", key: item.key },
  }));

  for (const thread of threads) {
    if (!thread.messages.length) continue;
    const texts = threadText(thread);
    const latestMessage = [...thread.messages].reverse().map((message) => message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.type === "text" ? part.text : "").join(""))
      .find((text) => text.trim())?.trim() ?? "";
    const title = thread.contact
      ? `${thread.contact.name} · ${thread.title}`
      : thread.title;
    entries.push({
      id: `thread:${thread.id}`, group: thread.contact ? "联系人对话" : "聊天记录",
      title, subtitle: latestMessage.slice(0, 120),
      keywords: texts.slice(-4000),
      target: { type: "thread", id: thread.id },
    });
  }

  for (const contact of contacts) {
    entries.push({
      id: `contact:${contact.id}`, group: "联系人", title: contact.name,
      subtitle: contact.description || (contact.kind === "official" ? "官方同伴" : "自建联系人"),
      keywords: [contact.tags, contact.kind === "official" ? "官方同伴" : "自建联系人"].filter(Boolean).join(" "),
      target: { type: "contact", id: contact.id },
    });
  }

  for (const setting of settings) {
    entries.push({
      id: `setting:${setting.id}`, group: "设置", title: setting.label,
      subtitle: setting.description, keywords: [setting.id, setting.title, settingsSearchAliases[setting.id]].filter(Boolean).join(" "),
      target: { type: "setting", section: setting.id },
    });
  }
  return entries;
}

export function filterSidebarSearch(entries: SidebarSearchEntry[], query: string, limit = 16) {
  const terms = query.normalize("NFKC").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return entries.filter((entry) => {
    const text = [entry.group, entry.title, entry.subtitle, entry.keywords]
      .filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  }).slice(0, limit);
}

/** A chat message the desktop full-text index matched (app_data_search). */
export interface ChatTextHit { threadId: string; snippet: string }

/**
 * Adds chats the full-text index found to the in-memory results. The memory
 * search covers each chat's last 4000 characters; the index covers every
 * message. A chat already in the results keeps its place and shows the
 * matched text; one only the index found joins the results after them.
 */
export function mergeChatTextHits(results: SidebarSearchEntry[], entries: SidebarSearchEntry[], hits: readonly ChatTextHit[], limit = 16) {
  if (!hits.length) return results;
  const snippets = new Map(hits.map((hit) => [`thread:${hit.threadId}`, hit.snippet]));
  const shown = new Set(results.map((entry) => entry.id));
  const withSnippets = results.map((entry) => snippets.has(entry.id) ? { ...entry, subtitle: snippets.get(entry.id)! } : entry);
  const added = hits.map((hit) => entries.find((entry) => entry.id === `thread:${hit.threadId}`))
    .filter((entry): entry is SidebarSearchEntry => Boolean(entry) && !shown.has(entry!.id))
    .map((entry) => ({ ...entry, subtitle: snippets.get(entry.id)! }));
  return [...withSnippets, ...added].slice(0, limit);
}
