import { useMemo, useState } from "react";
import { PuzzleIcon } from "@/components/foundations/icons/app-icons";
import type { PluginSettingsContribution } from "@/app/plugins/plugin-contributions";
import { settingValue, type PluginSettingField } from "@/app/plugins/plugin-settings";
import type { PluginSettingsPageId } from "@/app/plugins/slot-registry";
import type { ConfigurationField, ConfigurationValue } from "@/app/settings/configuration-types";
import { Button } from "@/components/base/buttons/button";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { SettingsFields } from "@/components/application/settings/nekopapa-settings-fields";
import { SettingsCard } from "@/components/application/settings/settings-rows";
import { usePluginContributions } from "@/hooks/use-ui-plugins";
import { pluginSettingsActions, usePluginSettingValues } from "@/hooks/use-plugin-settings";
import { pluginIcon } from "./plugin-icons";

/** A plugin field in the shape the shared settings rows render. */
function toConfigurationField(field: PluginSettingField): ConfigurationField {
  const base = { key: field.key, label: field.label, hint: field.description ?? "", initial: field.default };
  switch (field.type) {
    case "boolean": return { ...base, type: "boolean" };
    case "string": return { ...base, type: "text", maxLength: field.maxLength, ...(field.placeholder ? { placeholder: field.placeholder } : {}) };
    case "number": return { ...base, type: "number", min: field.min, max: field.max, step: field.step };
    case "select": return { ...base, type: "select", options: field.options.map((option) => [option.value, option.label] as const) };
  }
}

/** The settings page entry for the nav and header, or the closed-page fallback. */
export function pluginSettingsEntry(page: PluginSettingsContribution | undefined) {
  if (!page) return { label: "插件设置", title: "插件设置", description: "提供这个设置页的界面插件已停用或移除。", icon: PuzzleIcon };
  return {
    label: page.label, title: page.label, icon: pluginIcon(page.icon),
    description: [`来自界面插件“${page.plugin.pluginName}”`, page.description].filter(Boolean).join("。"),
  };
}

/**
 * 设置 → 插件 → <a plugin's page>: the fields its manifest declares, in the
 * shared settings rows. Each change is checked and saved at once on this
 * device; 恢复默认 clears this page's values. When the plugin is turned off
 * or removed while the page is open, the page says so instead.
 */
export function UiPluginSettingsPage({ pageId, onClose, onManage }: { pageId: PluginSettingsPageId; onClose: () => void; onManage: () => void }) {
  const page = usePluginContributions().settings.find((entry) => entry.id === pageId);
  const stored = usePluginSettingValues();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fields = useMemo(() => page?.fields.map(toConfigurationField) ?? [], [page]);
  if (!page) {
    return <>
      <ModalBody>
        <div className="flex flex-col items-start gap-3 px-3">
          <p className="text-body-2-regular text-text-secondary">提供这个设置页的界面插件已停用或移除，已保存的值没有改动；重新启用插件后这里会恢复。</p>
          <Button variant="secondary" size="small" onClick={onManage}>管理界面插件…</Button>
        </div>
      </ModalBody>
      <ModalFooter><Button variant="secondary" onClick={onClose}>关闭</Button></ModalFooter>
    </>;
  }
  const own = stored[page.plugin.pluginId];
  const values = Object.fromEntries(page.fields.map((field) => [field.key, settingValue(field, own)]));
  const customized = page.fields.some((field) => own && Object.prototype.hasOwnProperty.call(own, field.key));
  const change = (key: string, value: ConfigurationValue) => {
    const field = page.fields.find((candidate) => candidate.key === key);
    if (!field) return;
    const problem = pluginSettingsActions.set(page.plugin.pluginId, field, value);
    setErrors((current) => {
      const { [key]: _cleared, ...rest } = current;
      return problem ? { ...rest, [key]: problem } : rest;
    });
  };
  return <>
    <ModalBody>
      <div className="flex flex-col gap-3">
        <SettingsCard>
          <SettingsFields fields={fields} values={values} errors={errors} onChange={change} prefix={`plugin-settings-${page.id.replace(/[^a-z0-9-]/g, "-")}`} />
        </SettingsCard>
        <p className="px-3 text-body-2-regular text-text-tertiary">改动立即保存，只保存在这台设备上。NekoPapa 不运行插件代码；这些值目前只用于填写插件命令打开的网址。移除插件时一并清除。</p>
      </div>
    </ModalBody>
    <ModalFooter>
      <Button variant="secondary" onClick={() => { pluginSettingsActions.reset(page.plugin.pluginId, page.fields); setErrors({}); }} disabled={!customized}>恢复默认</Button>
      <Button variant="secondary" onClick={onClose}>关闭</Button>
    </ModalFooter>
  </>;
}
