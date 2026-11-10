import { useState } from "react";
import { CopyIcon, ExternalLinkIcon, GithubIcon } from "@/components/foundations/icons/app-icons";
import { cordisPatch, duplicateInstanceIds } from "@/app/cordis-plugins";
import type { ConfigurationRecord } from "@/app/configuration-types";
import { DSH_PLUGIN_SEARCH_URL, openExternal } from "@/platform/open-external";
import { Button } from "@/components/base/buttons/button";
import { SettingsSectionLabel } from "./settings-rows";

/**
 * Below the saved Cordis plugin entries: the same entries as a Cordis patch
 * (for `dsh --patch`), which the user can copy, and the GitHub search link.
 * The patch is generated from what is saved here only; NekoPapa does not
 * write it to `$DSH_HOME` or run dsh.
 */
export function CordisPatchSection({ records, onStatus }: { records: ConfigurationRecord[]; onStatus: (message: string, error?: boolean) => void }) {
  const [linkError, setLinkError] = useState("");
  const patch = cordisPatch(records);
  const duplicates = duplicateInstanceIds(records);
  const copy = () => navigator.clipboard.writeText(patch).then(
    () => onStatus("已复制 Cordis 补丁。"),
    () => onStatus("无法写入剪贴板，请手动选择文本复制。", true),
  );
  const search = () => {
    setLinkError("");
    openExternal(DSH_PLUGIN_SEARCH_URL).catch((error: unknown) => setLinkError(error instanceof Error ? error.message : "无法打开系统浏览器。"));
  };

  return <>
    {records.length > 0 && <section className="flex flex-col gap-2" aria-label="Cordis 补丁预览">
      <div className="flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <SettingsSectionLabel>Cordis 补丁预览</SettingsSectionLabel>
          <p className="px-3 text-body-2-regular text-text-tertiary">按 dsh README 的 insert 补丁格式由上面的配置生成，可保存为 .yml 后用 --patch 加载；尚未经 dsh 校验。</p>
        </div>
        <Button size="small" variant="secondary" leadingIcon={CopyIcon} className="shrink-0" onClick={copy}>复制</Button>
      </div>
      {duplicates.length > 0 && <p role="alert" className="px-3 text-body-2-regular text-text-error-primary">实例 ID 重复：{duplicates.join("、")}。Cordis 要求每个实例 ID 唯一。</p>}
      <pre translate="no" aria-label="Cordis 补丁" className="max-h-64 overflow-auto rounded-2xl bg-background-secondary-default p-3 font-mono text-caption-1-regular text-text-primary">{patch}</pre>
    </section>}
    <section className="flex flex-col gap-2" aria-label="查找插件">
      <SettingsSectionLabel>查找插件</SettingsSectionLabel>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-background-secondary-default py-2.5 ps-3 pe-2.5">
        <p className="min-w-0 flex-1 text-body-2-regular text-text-secondary">在系统浏览器中打开 GitHub 搜索；这里不读取搜索结果，也不需要 GitHub 登录。</p>
        <Button size="small" variant="secondary" leadingIcon={GithubIcon} trailingIcon={ExternalLinkIcon} onClick={search}
          aria-label="在 GitHub 搜索 DeepSeek Harness 插件（在系统浏览器中打开）">在 GitHub 搜索</Button>
      </div>
      {linkError && <p role="alert" className="px-3 text-body-2-regular text-text-error-primary">{linkError}</p>}
    </section>
  </>;
}
