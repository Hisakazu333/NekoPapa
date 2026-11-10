import { BookUserIcon, DatabaseIcon, FileLockIcon, LanguagesIcon, LayoutPanelLeftIcon, MessageCircleIcon, SettingsIcon } from "@/components/foundations/icons/app-icons";
import { formatStorageSize, measureLocalStorage, type LocalDataCategoryId, type LocalStorageUsage } from "@/app/settings/local-storage-usage";
import { Chip } from "@/components/base/badges/chip";
import { SettingsCard, SettingsSectionLabel } from "./settings-rows";

const icons: Record<LocalDataCategoryId, typeof MessageCircleIcon> = {
  settings: SettingsIcon, "settings-backup": FileLockIcon, chats: MessageCircleIcon,
  contacts: BookUserIcon, workspace: LayoutPanelLeftIcon, preferences: LanguagesIcon, other: DatabaseIcon,
};

/** Reads the current origin's storage; returns null when the WebView blocks access. */
export function readLocalStorageUsage(): LocalStorageUsage | null {
  try { return measureLocalStorage(globalThis.localStorage); } catch { return null; }
}

/**
 * Storage page summary and data table (BoardUI settings-modal Storage recipe),
 * listing what is really stored on this device and what the settings backup
 * includes. Read-only: clearing data belongs to each owning feature.
 */
export function StorageOverview({ usage }: { usage: LocalStorageUsage | null }) {
  if (!usage) return <p role="alert" className="rounded-2xl bg-background-secondary-default p-3 text-body-2-regular text-text-error-primary">无法读取本机存储用量，可能被系统或浏览器限制。设置导入导出仍可使用。</p>;
  return <>
    <div className="flex w-full flex-col gap-1 rounded-2xl bg-background-secondary-default py-3 ps-3 pe-2.5">
      <span className="inline-flex w-fit items-center rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-body-2-medium text-text-secondary">本机存储</span>
      <p className="mt-1 text-headline-medium text-text-primary">约 {formatStorageSize(usage.totalBytes)}</p>
      <p className="text-body-2-regular text-text-secondary">全部保存在当前设备的应用存储中，不会同步到云端。</p>
    </div>
    <section className="flex flex-col gap-2" aria-labelledby="local-data-heading">
      <div className="flex flex-col gap-0.5">
        <SettingsSectionLabel><span id="local-data-heading">本机数据</span></SettingsSectionLabel>
        <p className="px-3 text-body-2-regular text-text-tertiary">“导出设置”只包含设置与配置；聊天记录和联系人由各自页面管理。</p>
      </div>
      <SettingsCard>
        <ul aria-label="本机数据分类">
          {usage.categories.map((category) => {
            const Icon = icons[category.id];
            return <li key={category.id} className="flex w-full items-center gap-2.5 border-b border-separator-border py-2.5 pe-2.5 last:border-b-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-tertiary-default">
                <Icon className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 truncate text-body-medium text-text-primary">{category.label}</p>
                  <Chip variant="caption" color={category.inSettingsBackup ? "lime" : "soft"} className="shrink-0">{category.inSettingsBackup ? "包含在设置备份" : "不在设置备份中"}</Chip>
                </div>
                <p className="truncate text-body-2-regular text-text-secondary">{category.description}</p>
              </div>
              <span className="shrink-0 text-end text-body-2-regular tabular-nums text-text-secondary">
                {category.entries === 0 ? "暂无数据" : formatStorageSize(category.bytes)}
              </span>
            </li>;
          })}
        </ul>
      </SettingsCard>
    </section>
  </>;
}
