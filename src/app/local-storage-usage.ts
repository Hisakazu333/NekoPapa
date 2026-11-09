/**
 * Read-only inventory of what NekoPapa keeps in this browser profile / WebView.
 * Keys are listed by their owning modules; any other `nekopapa` key is counted
 * under "其他" so the total never hides data. Nothing here writes or deletes.
 */

export type LocalDataCategoryId = "settings" | "settings-backup" | "chats" | "contacts" | "workspace" | "preferences" | "other";

export interface LocalDataCategory {
  id: LocalDataCategoryId;
  label: string;
  description: string;
  /** Whether "导出设置" includes this data. */
  inSettingsBackup: boolean;
  keys: readonly string[];
}

export const localDataCategories: readonly LocalDataCategory[] = [
  // configuration-store.ts
  { id: "settings", label: "设置与配置", description: "设置页的偏好、模型、工具、技能、设备与钩子。", inSettingsBackup: true, keys: ["nekopapa.settings.v1"] },
  { id: "settings-backup", label: "设置备份", description: "导入前自动保留的配置，以及读取失败时保留的原文。", inSettingsBackup: false, keys: ["nekopapa.settings.v1.previous", "nekopapa.settings.v1.recovery"] },
  // agent-chat/thread-storage.ts
  { id: "chats", label: "聊天记录", description: "会话标题、消息与归档状态。", inSettingsBackup: false, keys: ["nekopapa:chat-threads:v1"] },
  // contacts-store.ts, use-contact-sections.ts, group-chat-store.ts
  { id: "contacts", label: "联系人与群聊", description: "联系人资料、分组与群聊成员。", inSettingsBackup: false, keys: ["nekopapa.contacts.v1", "nekopapa.contacts.sections.v1", "nekopapa.group-chats.v1"] },
  // workspace-model.ts (legacy DOM workspace index, kept for compatibility)
  { id: "workspace", label: "旧工作台索引", description: "早期版本的标签、分类与侧栏布局，仅用于兼容读取。", inSettingsBackup: false, keys: ["nekopapa.workspace-shell.v1"] },
  // application-language-store.ts, sidebar-pins.ts, project-folders.ts
  { id: "preferences", label: "界面偏好", description: "界面语言、侧栏固定入口和最近项目文件夹等不进入设置备份的本机偏好。", inSettingsBackup: false, keys: ["nekopapa.ui-language.v1", "nekopapa.sidebar-pins.v1", "nekopapa.project-folders.v1"] },
];

const otherCategory: LocalDataCategory = { id: "other", label: "其他", description: "其他 NekoPapa 本机数据。", inSettingsBackup: false, keys: [] };

export interface LocalDataUsage extends LocalDataCategory { bytes: number; entries: number }
export interface LocalStorageUsage { categories: LocalDataUsage[]; totalBytes: number }

/** The subset of `Storage` needed to list keys. */
export interface EnumerableStorage { readonly length: number; key(index: number): string | null; getItem(key: string): string | null }

/** Browsers store keys and values as UTF-16, two bytes per code unit. */
const sizeOf = (key: string, value: string) => (key.length + value.length) * 2;

export function measureLocalStorage(storage: EnumerableStorage): LocalStorageUsage {
  const usage = new Map<LocalDataCategoryId, LocalDataUsage>(
    [...localDataCategories, otherCategory].map((category) => [category.id, { ...category, bytes: 0, entries: 0 }]),
  );
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key === null || !/^nekopapa[.:]/.test(key)) continue;
    const value = storage.getItem(key) ?? "";
    const category = localDataCategories.find((entry) => entry.keys.includes(key))?.id ?? "other";
    const target = usage.get(category)!;
    target.bytes += sizeOf(key, value);
    target.entries += 1;
  }
  const categories = [...usage.values()].filter((category) => category.id !== "other" || category.entries > 0);
  return { categories, totalBytes: categories.reduce((total, category) => total + category.bytes, 0) };
}

export function formatStorageSize(bytes: number): string {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(0.1, Math.round(bytes / 102.4) / 10)} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}
