import type { LocalStorageUsage } from "./local-storage-usage";

/**
 * 设置 → 数据与备份: everything NekoPapa keeps on this computer in a few
 * groups people recognise, for the usage bar. On desktop it joins the data
 * folder (chat history file, cache, files, logs) with WebView storage; in
 * the browser only browser storage exists. Every byte counted lands in
 * exactly one group, so the groups add up to the total.
 */

export type StorageGroupId = "chats" | "contacts" | "settings" | "cache" | "other";

export interface StorageGroup { id: StorageGroupId; label: string; description: string; bytes: number }
export interface StorageBreakdown { groups: StorageGroup[]; totalBytes: number }

/** The data folder's sections as the host reports them (app_data.rs). */
export interface FolderSections { sections: readonly { id: string; bytes: number }[] }

const COPY: Record<StorageGroupId, { label: string; description: string }> = {
  chats: { label: "聊天记录", description: "会话标题、消息与归档状态。" },
  contacts: { label: "联系人与群聊", description: "联系人资料、头像、分组与群聊成员。" },
  settings: { label: "设置与偏好", description: "设置、模型与工具配置、设置备份和界面偏好。" },
  cache: { label: "缓存", description: "可随时清理，需要时重新生成。" },
  other: { label: "其他", description: "迁移前的聊天备份副本、文件、日志和其他本机数据。" },
};

export function storageBreakdown(local: LocalStorageUsage | null, folder?: FolderSections): StorageBreakdown {
  const webView = (...ids: string[]) => local?.categories.filter((category) => ids.includes(category.id)).reduce((total, category) => total + category.bytes, 0) ?? 0;
  const section = (id: string) => folder?.sections.find((entry) => entry.id === id)?.bytes ?? 0;
  const bytes: Record<StorageGroupId, number> = folder
    ? {
      chats: section("data"),
      contacts: webView("contacts"),
      settings: webView("settings", "settings-backup", "preferences", "workspace"),
      cache: section("cache"),
      // On desktop the WebView chat history is the copy left from the move.
      other: webView("other", "chats") + section("files") + section("logs"),
    }
    : {
      chats: webView("chats"),
      contacts: webView("contacts"),
      settings: webView("settings", "settings-backup", "preferences", "workspace"),
      cache: 0,
      other: webView("other"),
    };
  // The browser has no cache of its own to show.
  const ids: StorageGroupId[] = folder ? ["chats", "contacts", "settings", "cache", "other"] : ["chats", "contacts", "settings", "other"];
  const groups = ids.map((id) => ({ id, ...COPY[id], bytes: bytes[id] }));
  return { groups, totalBytes: groups.reduce((total, group) => total + group.bytes, 0) };
}
