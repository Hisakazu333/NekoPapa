import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { FolderOpenIcon } from "@/components/foundations/icons/app-icons";
import { Button } from "@/components/base/buttons/button";
import { formatStorageSize } from "@/app/settings/local-storage-usage";
import { clearDataCache, dataFolderAvailable, openDataFolder, readDataFolderInfo, type DataFolderInfo } from "@/platform/app-data-bridge";
import { appDataStorage, type AppDataStatus } from "@/platform/app-data-storage";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";

const IDLE: AppDataStatus = { pending: 0, error: null };
const noSubscription = () => () => {};

function useWriteStatus(): AppDataStatus {
  const files = appDataStorage();
  return useSyncExternalStore(files?.subscribe ?? noSubscription, files?.status ?? (() => IDLE));
}

/**
 * The desktop data folder's usage (src-tauri/src/app_data.rs), re-read after
 * each finished chat history write and on demand. In the browser there is no
 * folder: `info` stays undefined and nothing is requested.
 */
export function useDataFolder() {
  const available = dataFolderAvailable();
  const status = useWriteStatus();
  const [info, setInfo] = useState<DataFolderInfo>();
  const [loading, setLoading] = useState(available);
  const [error, setError] = useState<string>();
  const refresh = useCallback(async () => {
    if (!available) return;
    setLoading(true);
    try { setInfo(await readDataFolderInfo()); setError(undefined); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "无法读取本机数据文件夹。"); }
    finally { setLoading(false); }
  }, [available]);
  useEffect(() => { if (status.pending === 0) void refresh(); }, [refresh, status.pending]);
  return { available, info, loading, error, refresh, status };
}

const folderBytes = (info: DataFolderInfo) => info.sections.reduce((total, section) => total + section.bytes, 0);

/**
 * “各文件夹的存储用量” and the clean-up actions under the usage bar. The
 * browser preview shows where its data lives instead of a folder.
 */
export function DataFolderSection({ folder }: { folder: ReturnType<typeof useDataFolder> }) {
  const { available, info, loading, error, refresh, status } = folder;
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();
  const [clearing, setClearing] = useState(false);
  const cache = info?.sections.find((section) => section.id === "cache");

  const open = () => { void openDataFolder().catch((reason: Error) => setFeedback({ text: reason.message, error: true })); };
  const clear = async () => {
    setClearing(true);
    try {
      const freed = await clearDataCache();
      setFeedback({ text: freed ? `已清理缓存，释放 ${formatStorageSize(freed)}。` : "缓存已经是空的。" });
      await refresh();
    } catch (reason) {
      setFeedback({ text: reason instanceof Error ? reason.message : "无法清理缓存。", error: true });
    } finally { setClearing(false); }
  };

  return <>
    <section className="flex flex-col gap-2" aria-labelledby="data-folder-heading">
      <SettingsSectionLabel><span id="data-folder-heading">各文件夹的存储用量</span></SettingsSectionLabel>
      <SettingsCard>
        {available
          ? <SettingsRow label="应用数据文件夹" description={info?.root ?? error ?? "正在读取…"}>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-body-2-regular tabular-nums text-text-secondary">{loading ? "正在计算…" : info ? formatStorageSize(folderBytes(info)) : ""}</span>
              <Button variant="secondary" size="small" leadingIcon={FolderOpenIcon} onClick={open}>浏览</Button>
            </span>
          </SettingsRow>
          : <SettingsRow label="浏览器存储" description="浏览器预览没有本机数据文件夹，数据保存在当前浏览器的存储中；桌面应用把聊天记录保存为文件。" />}
      </SettingsCard>
    </section>

    {available && <SettingsCard>
      <SettingsRow label="清理缓存" description={cache?.bytes ? `缓存占用 ${formatStorageSize(cache.bytes)}，清理后需要时会重新生成，不影响聊天记录和设置。` : "目前没有缓存。清理后需要时会重新生成，不影响聊天记录和设置。"}>
        <Button variant="secondary" size="small" disabled={clearing || !cache?.bytes} onClick={() => void clear()}>{clearing ? "正在清理…" : "清理"}</Button>
      </SettingsRow>
    </SettingsCard>}

    {status.error && <p role="alert" className="px-3 text-body-2-regular text-text-error-primary">{status.error} 聊天页的“重试”会重新写入。</p>}
    {feedback && <p role={feedback.error ? "alert" : "status"} className={feedback.error ? "px-3 text-body-2-regular text-text-error-primary" : "px-3 text-body-2-regular text-text-secondary"}>{feedback.text}</p>}
  </>;
}
