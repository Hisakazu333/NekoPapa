/**
 * Storage for data the desktop app keeps as files in its own folder
 * (src-tauri/src/app_data.rs) instead of WebView storage, which is capped at
 * a few megabytes and cannot hold files. It keeps the synchronous `Storage`
 * shape the stores already use: the files are read once before the app
 * renders, reads come from memory, and every write goes to disk in order.
 * Keys that are not kept as files pass through to WebView storage.
 *
 * In the browser preview nothing is installed and `chatStorage()` is plain
 * localStorage. The bridge to the host lives in app-data-bridge.ts.
 */

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** WebView storage key → file name in `data/` (without .json). */
export const FILE_STORES: Readonly<Record<string, string>> = {
  "nekopapa:chat-threads:v1": "chat-threads",
};

/** A store in the data folder that could not be read; its message is shown as is. */
export class DataFolderError extends Error {}

export interface AppDataWriter { write(name: string, text: string): Promise<void> }

export interface AppDataStatus {
  /** Writes sent to disk and not yet confirmed. */
  pending: number;
  /** Why the last write failed; cleared by the next successful write. */
  error: string | null;
}

export class AppDataStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private state: AppDataStatus = { pending: 0, error: null };

  /**
   * `files` holds the stores read from disk. A store whose read failed is in
   * `unreadable`: reading it throws, so the history's read gate keeps the
   * failure visible and never saves an empty history over the file.
   */
  constructor(
    private readonly writer: AppDataWriter,
    private readonly fallback: KeyValueStorage,
    files: ReadonlyMap<string, string>,
    private readonly unreadable: string | null = null,
  ) {
    for (const [name, text] of files) this.values.set(name, text);
  }

  getItem(key: string): string | null {
    const name = FILE_STORES[key];
    if (!name) return this.fallback.getItem(key);
    if (this.unreadable) throw new DataFolderError(this.unreadable);
    return this.values.get(name) ?? null;
  }

  setItem(key: string, value: string): void {
    const name = FILE_STORES[key];
    if (!name) { this.fallback.setItem(key, value); return; }
    if (this.unreadable) throw new DataFolderError(this.unreadable);
    this.values.set(name, value);
    this.update({ pending: this.state.pending + 1 });
    // Writes run one after another, so the file always ends with the last value.
    this.queue = this.queue.then(() => this.writer.write(name, value)).then(
      () => this.update({ pending: this.state.pending - 1, error: null }),
      (error: unknown) => this.update({ pending: this.state.pending - 1, error: typeof error === "string" ? error : error instanceof Error ? error.message : "聊天记录未能写入本机数据文件夹。" }),
    );
  }

  /** Files cannot be removed from here; a store is cleared by writing it. */
  removeItem(key: string): void {
    if (FILE_STORES[key]) throw new Error("数据文件不能从这里删除。");
    this.fallback.removeItem(key);
  }

  status = (): AppDataStatus => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Resolves once every write sent so far has finished (or failed). */
  settled(): Promise<void> { return this.queue; }

  private update(patch: Partial<AppDataStatus>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

let installed: AppDataStorage | undefined;

export function installAppDataStorage(storage: AppDataStorage) { installed = storage; }

/** The desktop app's file storage, once installed at startup. */
export function appDataStorage(): AppDataStorage | undefined { return installed; }

/** Where chat history lives: the data folder on desktop, localStorage in the browser. */
export function chatStorage(): KeyValueStorage { return installed ?? globalThis.localStorage; }

/**
 * On first start with a data folder, a store that does not exist as a file
 * yet is taken from WebView storage and written out. The WebView copy is
 * left in place as a backup and is no longer read.
 */
export function migrateFromWebView(files: Map<string, string>, webView: Pick<Storage, "getItem">) {
  const migrated: { key: string; text: string }[] = [];
  for (const [key, name] of Object.entries(FILE_STORES)) {
    if (files.has(name)) continue;
    const text = webView.getItem(key);
    if (text === null) continue;
    files.set(name, text);
    migrated.push({ key, text });
  }
  return migrated;
}
