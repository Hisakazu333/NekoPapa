import { useId, useState } from "react";
import { BookUserIcon, ChevronRightIcon, DatabaseIcon, FileLockIcon, LanguagesIcon, LayoutPanelLeftIcon, MessageCircleIcon, RefreshCwIcon, SettingsIcon } from "@/components/foundations/icons/app-icons";
import { formatStorageSize, measureLocalStorage, type LocalDataCategoryId, type LocalStorageUsage } from "@/app/settings/local-storage-usage";
import type { StorageBreakdown, StorageGroupId } from "@/app/settings/storage-breakdown";
import { Button } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { cx } from "@/utils/cx";
import { SettingsCard } from "./settings-rows";

const icons: Record<LocalDataCategoryId, typeof MessageCircleIcon> = {
  settings: SettingsIcon, "settings-backup": FileLockIcon, chats: MessageCircleIcon,
  contacts: BookUserIcon, workspace: LayoutPanelLeftIcon, preferences: LanguagesIcon, other: DatabaseIcon,
};

/** Categorical chart colours (design-system: chart-1 … chart-9), one per group. */
const SWATCH: Record<StorageGroupId, string> = {
  chats: "bg-chart-1", contacts: "bg-chart-2", settings: "bg-chart-3", cache: "bg-chart-4", other: "bg-chart-5",
};

const CHATS_MOVED = "已移到本机数据文件夹；这里只剩迁移前的备份副本，不再读取。";

/** Reads the current origin's storage; returns null when the WebView blocks access. */
export function readLocalStorageUsage(): LocalStorageUsage | null {
  try { return measureLocalStorage(globalThis.localStorage); } catch { return null; }
}

/**
 * Top of 设置 → 数据与备份 (layout after the Codex / ChatGPT storage page):
 * the total NekoPapa takes on this computer, one bar split by group, a
 * legend with each group's size, and the per-key table behind a disclosure.
 * Read-only: clearing belongs to the actions below and to each feature.
 */
export function StorageOverview({ usage, breakdown, loading, onRefresh, chatsInDataFolder = false }: {
  usage: LocalStorageUsage | null;
  breakdown: StorageBreakdown;
  loading: boolean;
  onRefresh: () => void;
  chatsInDataFolder?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const { groups, totalBytes } = breakdown;
  const summary = groups.map((group) => `${group.label} ${formatStorageSize(group.bytes)}`).join("，");

  return <section className="flex flex-col gap-4" aria-labelledby={`${detailsId}-heading`}>
    <div className="flex flex-col gap-1">
      <h3 id={`${detailsId}-heading`} className="text-headline-semibold text-text-primary">此设备</h3>
      <p className="text-body-2-regular text-text-secondary">管理保存在这台电脑上的聊天、联系人和设置，不会同步到云端。</p>
    </div>

    <div className="flex items-center justify-between gap-3">
      <p className="text-body-medium text-text-primary">NekoPapa 占用 {formatStorageSize(totalBytes)}</p>
      <Button variant="secondary" size="small" leadingIcon={RefreshCwIcon} disabled={loading} onClick={onRefresh}
        className={cx(loading && "[&_svg]:animate-spin motion-reduce:[&_svg]:animate-none")}>
        {loading ? "正在更新…" : "重新计算"}
      </Button>
    </div>

    <div role="img" aria-label={`存储占用：${summary}`} className="flex h-6 w-full gap-0.5 overflow-hidden rounded-full bg-chart-track">
      {totalBytes > 0 && groups.filter((group) => group.bytes > 0).map((group) =>
        <span key={group.id} className={cx("h-full min-w-1.5 transition-[flex-grow] duration-300 motion-reduce:transition-none", SWATCH[group.id])}
          style={{ flexGrow: group.bytes, flexBasis: 0 }} />)}
    </div>

    <ul aria-label="存储分组" className="flex flex-wrap gap-x-8 gap-y-3">
      {groups.map((group) => <li key={group.id} title={group.description} className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-body-2-medium text-text-primary">
          <span aria-hidden className={cx("size-2 shrink-0 rounded-full", SWATCH[group.id])} />{group.label}
        </span>
        <span className="ps-4 text-caption-1-regular tabular-nums text-text-tertiary">
          {group.bytes ? formatStorageSize(group.bytes) : "暂无数据"}{loading ? " · 正在更新…" : ""}
        </span>
      </li>)}
    </ul>

    <div className="flex flex-col gap-2">
      <button type="button" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((value) => !value)}
        className="flex w-fit cursor-pointer items-center gap-1 rounded-md text-body-2-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <ChevronRightIcon aria-hidden className={cx("size-4 transition-transform motion-reduce:transition-none", open && "rotate-90")} />
        应用存储占用明细
      </button>
      <div id={detailsId} hidden={!open}>
        {usage
          ? <DetailList usage={usage} chatsInDataFolder={chatsInDataFolder} />
          : <p role="alert" className="rounded-2xl bg-background-secondary-default p-3 text-body-2-regular text-text-error-primary">无法读取应用存储用量，可能被系统或浏览器限制。设置导入导出仍可使用。</p>}
      </div>
    </div>
  </section>;
}

/** Each WebView storage group and whether “导出设置” includes it. */
function DetailList({ usage, chatsInDataFolder }: { usage: LocalStorageUsage; chatsInDataFolder: boolean }) {
  return <SettingsCard>
    <p className="py-2.5 pe-2.5 text-caption-1-regular text-text-tertiary">应用存储（WebView）中的数据。“导出设置”只包含设置与配置；聊天记录和联系人由各自页面管理。</p>
    <ul aria-label="应用存储分类" className="border-t border-separator-border">
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
            <p className="truncate text-body-2-regular text-text-secondary">{chatsInDataFolder && category.id === "chats" ? CHATS_MOVED : category.description}</p>
          </div>
          <span className="shrink-0 text-end text-body-2-regular tabular-nums text-text-secondary">
            {category.entries === 0 ? "暂无数据" : formatStorageSize(category.bytes)}
          </span>
        </li>;
      })}
    </ul>
  </SettingsCard>;
}
