import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * The desktop host's keychain for API keys typed in 设置 → 模型与 API
 * (src-tauri/src/credential_store.rs). The page hands a key over once and
 * keeps only the record id; the browser preview has no keychain.
 */
export const canStoreKeys = () => isTauri();
/** Where a key typed before the record exists goes, so 获取模型列表 can use it. */
export const DRAFT_KEY_ID = "draft";

const reason = (error: unknown) => typeof error === "string" ? error : "无法访问钥匙串。";

export async function storeModelKey(id: string, secret: string): Promise<void> {
  try { await invoke("credential_set", { id, secret }); } catch (error) { throw new Error(reason(error)); }
}

export async function deleteModelKey(id: string): Promise<void> {
  try { await invoke("credential_delete", { id }); } catch { /* a missing key is fine */ }
}

export async function storedModelKeys(ids: string[]): Promise<Set<string>> {
  if (!isTauri() || ids.length === 0) return new Set();
  try { return new Set(await invoke<string[]>("credential_has", { ids })); } catch { return new Set(); }
}
