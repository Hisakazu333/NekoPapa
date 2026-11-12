import { useRef, useState } from "react";
import { FolderOpenIcon, RefreshCwIcon } from "@/components/foundations/icons/app-icons";
import { checkPluginManifest, type ManifestCheck } from "@/app/plugins/plugin-manifest";
import { readPluginFolder, unmetRequirement } from "@/app/plugins/plugin-host";
import type { PluginRecord } from "@/app/plugins/plugin-records";
import { canPickFolder, folderPickerError, pickProjectFolder } from "@/app/projects/native-folder-picker";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { Switch } from "@/components/base/switch/switch";
import { toast } from "@/components/base/toast/toast";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "@/components/application/settings/settings-rows";
import { pluginActions, refreshPlugins, useUiPlugins } from "@/hooks/use-ui-plugins";
import { PluginReviewCard } from "./plugin-review-card";

type Pending = { folder: string; check: ManifestCheck };

function summary(record: PluginRecord) {
  if (record.problem) return record.problem;
  if (!record.enabled) return "已停用";
  const { views, commands, settings, requires } = record.manifest;
  const parts = [views.length && `${views.length} 个工作面板标签`, commands.length && `${commands.length} 条命令`, settings.length && `${settings.length} 个设置页`].filter(Boolean);
  const unmet = unmetRequirement(requires);
  return `${parts.join("、")}${unmet ? ` · ${unmet}` : ""}`;
}

/**
 * 设置 → 插件 → 界面插件: add a plugin from a folder (the desktop app's
 * folder picker, or a typed path through the dev server in the browser
 * preview), review its manifest, then turn it on or off, read its folder
 * again or remove it. Removing forgets the plugin; its folder is untouched.
 */
export function UiPluginsSettingsPanel({ onClose }: { onClose: () => void }) {
  const { records, refreshing } = useUiPlugins();
  const [pending, setPending] = useState<Pending>();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const addRef = useRef<HTMLDivElement>(null);
  // The review card closed: give focus back to the folder button or path field.
  const close = () => {
    setPending(undefined);
    requestAnimationFrame(() => addRef.current?.querySelector<HTMLElement>("input, button")?.focus());
  };

  const read = async (folder: string) => {
    setBusy(true);
    setError("");
    try {
      const file = await readPluginFolder(folder);
      setPending({ folder: file.folder, check: checkPluginManifest(file.text) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取失败。");
    } finally {
      setBusy(false);
    }
  };
  const choose = async () => {
    try {
      const folder = await pickProjectFolder();
      if (folder) await read(folder);
    } catch (cause) {
      setError(`无法打开系统文件夹窗口：${folderPickerError(cause)}`);
    }
  };
  const enable = () => {
    if (!pending?.check.ok) return;
    pluginActions.add(pending.folder, pending.check.manifest);
    toast.success(`已启用“${pending.check.manifest.name}”`);
    setTyped("");
    close();
  };
  const replaces = pending?.check.ok ? records.find((record) => record.id === (pending.check as { manifest: { id: string } }).manifest.id)?.manifest.name : undefined;

  return <>
    <ModalBody>
      <div className="flex flex-col gap-5">
        <p className="text-body-2-regular text-text-secondary">界面插件是一个带 nekopapa-plugin.json 的文件夹，声明它往右侧面板、命令面板和设置添加的视图、命令与设置页。命令和设置页由 NekoPapa 自己显示；右侧视图可以是插件自己的网页，在沙箱里运行，不能联网，也不能访问应用、你的数据和本机文件，只能通过你授予的权限请求 NekoPapa 做事。侧栏入口等位置会在后续版本开放。</p>
        {pending
          ? <PluginReviewCard folder={pending.folder} check={pending.check} replaces={replaces} onEnable={enable} onCancel={close} />
          : <div ref={addRef} className="flex flex-col gap-2">
            {canPickFolder()
              ? <div><Button variant="secondary" size="small" leadingIcon={FolderOpenIcon} disabled={busy} onClick={() => void choose()}>从文件夹添加…</Button></div>
              : <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); if (typed.trim()) void read(typed.trim()); }}>
                <Input label="插件文件夹的完整路径" value={typed} onChange={setTyped} size="small" placeholder="/Users/…/my-plugin" className="min-w-0 flex-1"
                  hint="浏览器预览经本地开发服务器读取清单；桌面应用里用系统文件夹窗口选择。" />
                <Button type="submit" variant="secondary" size="small" disabled={busy || !typed.trim()}>读取</Button>
              </form>}
            {error && <p role="alert" className="text-caption-1-regular text-text-error-primary">{error}</p>}
          </div>}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <SettingsSectionLabel className="w-auto">已添加</SettingsSectionLabel>
            {records.length > 0 && <Button variant="ghost" size="small" leadingIcon={RefreshCwIcon} disabled={refreshing} onClick={() => void refreshPlugins()}>
              {refreshing ? "正在读取…" : "重新读取"}</Button>}
          </div>
          {records.length === 0
            ? <p className="px-3 text-body-2-regular text-text-tertiary">还没有添加界面插件。</p>
            : <SettingsCard>
              {records.map((record) => <SettingsRow key={record.id} label={`${record.manifest.name} ${record.manifest.version}`}
                description={`${summary(record)} · ${record.folder}`} error={record.problem}>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" size="small" onClick={() => { pluginActions.remove(record.id); toast.info(`已移除“${record.manifest.name}”`, { description: "它在这台设备上的设置值已一并清除；插件文件夹没有改动，可以随时重新添加。" }); }}>移除</Button>
                  <Switch aria-label={`启用“${record.manifest.name}”`} isSelected={record.enabled} onChange={(next) => pluginActions.setEnabled(record.id, next)} />
                </div>
              </SettingsRow>)}
            </SettingsCard>}
        </div>
      </div>
    </ModalBody>
    <ModalFooter><Button variant="secondary" onClick={onClose}>关闭</Button></ModalFooter>
  </>;
}
