import { useEffect, useRef } from "react";
import { CircleAlertIcon } from "@/components/foundations/icons/app-icons";
import { PLUGIN_PERMISSIONS, PLUGIN_REQUIREMENTS, type ManifestCheck } from "@/app/plugins/plugin-manifest";
import { unmetRequirement } from "@/app/plugins/plugin-host";
import { Button } from "@/components/base/buttons/button";
import { SettingsCard, SettingsRow } from "@/components/application/settings/settings-rows";
import { pluginIcon } from "./plugin-icons";

const LIST = "flex flex-col gap-1 text-body-2-regular text-text-secondary";

/**
 * What a plugin folder's manifest asks for, before anything is saved: who
 * it is, the permissions (granted now, or not open yet), what it needs and
 * the entries it adds. A manifest with problems lists every one and cannot
 * be enabled. Enabling saves it; cancel leaves nothing behind.
 */
export function PluginReviewCard({ folder, check, replaces, onEnable, onCancel }: {
  folder: string;
  check: ManifestCheck;
  /** Name of the added plugin with the same id, which enabling replaces. */
  replaces?: string;
  onEnable: () => void;
  onCancel: () => void;
}) {
  // The path field or folder button is gone now: move focus to the result.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  if (!check.ok) {
    return <div ref={ref} tabIndex={-1} role="alert" className="flex flex-col gap-3 rounded-2xl bg-background-primary-default p-4 outline-none">
      <div className="flex items-center gap-2 text-body-medium text-text-error-primary">
        <CircleAlertIcon className="size-[18px] shrink-0" aria-hidden />这个文件夹的清单不能使用
      </div>
      <p className="break-all text-caption-1-regular text-text-tertiary">{folder}</p>
      <ul className={`${LIST} list-disc ps-5`}>{check.errors.map((error) => <li key={error}>{error}</li>)}</ul>
      <div className="flex justify-end"><Button variant="secondary" size="small" onClick={onCancel}>关闭</Button></div>
    </div>;
  }
  const { manifest, warnings } = check;
  const open = manifest.permissions.filter((permission) => PLUGIN_PERMISSIONS[permission]?.open);
  return <div ref={ref} tabIndex={-1} className="flex flex-col gap-3 outline-none" aria-label={`确认添加“${manifest.name}”`} role="group">
    <SettingsCard>
      <SettingsRow label={`${manifest.name} ${manifest.version}`} description={manifest.description ?? manifest.id}>
        <span translate="no" className="shrink-0 text-caption-1-regular text-text-tertiary">{manifest.id}</span>
      </SettingsRow>
      <SettingsRow label="文件夹" description={folder}/>
      <SettingsRow label="权限" description={open.length ? open.map((permission) => PLUGIN_PERMISSIONS[permission].label).join("；") : "不需要任何权限"}/>
      {manifest.requires.length > 0 && <SettingsRow label="前置条件"
        description={manifest.requires.map((requirement) => `${PLUGIN_REQUIREMENTS[requirement]}${unmetRequirement([requirement]) ? "（当前不满足）" : ""}`).join("；")}/>}
      {manifest.cordis && <SettingsRow label="关联的 Cordis 插件" description={`${manifest.cordis.module}${manifest.cordis.instanceId ? ` · ${manifest.cordis.instanceId}` : ""}。执行层接入前不会加载。`}/>}
    </SettingsCard>
    <div className="flex flex-col gap-2 px-3">
      <p className="text-body-2-medium text-text-primary">会添加</p>
      <ul className={LIST}>
        {manifest.views.map((view) => { const Icon = pluginIcon(view.icon); return <li key={view.id} className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />工作面板标签“{view.title}”</li>; })}
        {manifest.commands.map((command) => <li key={command.id} className="flex items-center gap-2">
          <span className="size-4 shrink-0" aria-hidden />命令面板“{command.title}”{"openUrl" in command.action ? `（打开 ${new URL(command.action.openUrl.replace(/\{[^{}]*\}/g, "x")).host}）` : ""}</li>)}
        {manifest.settings.map((section) => { const Icon = pluginIcon(section.icon); return <li key={section.id} className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />设置页“{section.title}”（{section.fields.length} 项，值只保存在这台设备上）</li>; })}
      </ul>
      {warnings.length > 0 && <ul className={`${LIST} list-disc ps-5 text-text-tertiary`}>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      <p className="text-caption-1-regular text-text-tertiary">NekoPapa 只读取这个文件夹里的 nekopapa-plugin.json，用自己的界面显示上面的内容，不运行插件里的任何代码。{replaces ? `启用后会替换已添加的“${replaces}”。` : ""}</p>
    </div>
    <div className="flex justify-end gap-2">
      <Button variant="secondary" size="small" onClick={onCancel}>取消</Button>
      <Button variant="primary" size="small" onClick={onEnable}>启用插件</Button>
    </div>
  </div>;
}
