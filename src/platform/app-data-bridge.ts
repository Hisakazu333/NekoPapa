import { invoke, isTauri } from "@tauri-apps/api/core";
import { AppDataStorage, installAppDataStorage, migrateFromWebView, type AppDataWriter } from "./app-data-storage";

export interface DataSectionUsage { id: "data" | "files" | "cache" | "logs"; path: string; bytes: number; files: number }
export interface DataFolderInfo { root: string; sections: DataSectionUsage[] }

const message = (error: unknown, fallback: string) => typeof error === "string" ? error : fallback;

const writer: AppDataWriter = { write: (name, text) => invoke("app_data_write", { name, text }) };

/**
 * Called once before the app renders. On desktop, reads the data folder,
 * moves chat history out of WebView storage on first start and installs the
 * file storage. A failed read is installed as unreadable, so chat history
 * shows the error and is not overwritten. In the browser it does nothing.
 */
export async function prepareAppData(): Promise<void> {
  if (!isTauri()) return;
  const files = new Map<string, string>();
  let unreadable: string | null = null;
  try {
    for (const store of await invoke<{ name: string; text: string }[]>("app_data_read")) files.set(store.name, store.text);
  } catch (error) {
    unreadable = `无法读取本机数据文件夹中的聊天记录（${message(error, "未知错误")}），已阻止覆盖原文件。`;
  }
  let migrated: { key: string; text: string }[] = [];
  if (!unreadable) {
    // History not yet moved must not look empty: that would start a new file without it.
    try { migrated = migrateFromWebView(files, globalThis.localStorage); }
    catch { unreadable = "无法读取 WebView 中的旧聊天记录以迁移到本机数据文件夹，已暂停保存聊天记录。"; }
  }
  const storage = new AppDataStorage(writer, globalThis.localStorage, files, unreadable);
  // Written through the queue: a failure shows like any other write failure.
  for (const { key, text } of migrated) storage.setItem(key, text);
  installAppDataStorage(storage);
}

export const dataFolderAvailable = () => isTauri();

export async function readDataFolderInfo(): Promise<DataFolderInfo> {
  try { return await invoke<DataFolderInfo>("app_data_info"); }
  catch (error) { throw new Error(message(error, "无法读取本机数据文件夹。")); }
}

export async function openDataFolder(section?: DataSectionUsage["id"]): Promise<void> {
  try { await invoke("app_data_open", { section: section ?? null }); }
  catch (error) { throw new Error(message(error, "无法打开数据文件夹。")); }
}

/** Empties cache/ and returns the bytes freed. */
export async function clearDataCache(): Promise<number> {
  try { return await invoke<number>("app_data_clear_cache"); }
  catch (error) { throw new Error(message(error, "无法清理缓存。")); }
}

export interface ChatSearchHit { threadId: string; messageId: string; snippet: string }

/** Every chat message, through the local database's full-text index (desktop only). */
export async function searchChatMessages(query: string, limit = 20): Promise<ChatSearchHit[]> {
  try { return await invoke<ChatSearchHit[]>("app_data_search", { query, limit }); }
  catch (error) { throw new Error(message(error, "无法搜索聊天记录。")); }
}
