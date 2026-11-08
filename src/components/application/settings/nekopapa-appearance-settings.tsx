import { useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { Select, SelectItem } from "@/components/base/select/select";
import { AccentColorOptions } from "@/components/application/theme/accent-color-options";
import { normalizeAppearanceAccent, normalizeAppearanceMode, type AppearanceAccent, type AppearanceMode } from "@/app/appearance-preferences";
import { saveConfigurationDraft } from "@/app/configuration-draft";
import type { ConfigurationValues } from "@/app/configuration-types";
import { useThemeMode } from "@/components/application/theme/theme-toggle";
import { useConfiguration } from "@/hooks/use-configuration";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";

const modeOptions = [
  { id: "system", label: "跟随系统" },
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
] as const satisfies readonly { id: AppearanceMode; label: string }[];

const equal = (left: ConfigurationValues, right: ConfigurationValues) => JSON.stringify(left) === JSON.stringify(right);

export function AppearanceSettingsPanel({ onClose }: { onClose: () => void }) {
  const { store, data, storageAvailable, notice, refresh } = useConfiguration();
  const currentTheme = useThemeMode();
  const [base, setBase] = useState<ConfigurationValues>(() => ({ ...data.groups.appearance }));
  const [mode, setMode] = useState<AppearanceMode>(() => normalizeAppearanceMode(data.groups.appearance.mode));
  const [accent, setAccent] = useState<AppearanceAccent>(() => normalizeAppearanceAccent(data.groups.appearance.accent));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const dirty = mode !== normalizeAppearanceMode(base.mode) || accent !== normalizeAppearanceAccent(base.accent);
  const updated = !equal(data.groups.appearance, base);

  useEffect(() => {
    if (!dirty && updated) {
      const current = { ...data.groups.appearance };
      setBase(current);
      setMode(normalizeAppearanceMode(current.mode));
      setAccent(normalizeAppearanceAccent(current.accent));
    }
  }, [data, dirty, updated]);

  const loadCurrent = () => {
    const current = { ...store.data.groups.appearance };
    setBase(current);
    setMode(normalizeAppearanceMode(current.mode));
    setAccent(normalizeAppearanceAccent(current.accent));
    setErrors({});
    setConflicts([]);
    setStatus("已载入当前保存的外观。");
  };

  const save = (overwrite = false) => {
    const draft = { ...base, mode, accent };
    const result = saveConfigurationDraft(store, "appearance", draft, base, overwrite);
    refresh();
    setErrors(result.errors);
    setConflicts(result.conflicts);
    if (!result.saved) {
      setStatus("");
      return;
    }
    setBase(result.values);
    setMode(normalizeAppearanceMode(result.values.mode));
    setAccent(normalizeAppearanceAccent(result.values.accent));
    setStatus("外观已保存并立即应用到客户端。");
  };

  const retry = () => {
    const saved = store.persist();
    refresh();
    setErrors(saved ? {} : { form: store.notice });
    if (!saved) return;
    setStatus(dirty ? "本机保存已恢复，当前草稿仍保留。保存外观后应用你的选择。" : "当前窗口中的外观已保存。");
  };

  return (
    <>
      <ModalBody>
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2" aria-label="视觉风格">
            <SettingsSectionLabel>视觉风格</SettingsSectionLabel>
            <SettingsCard>
              <SettingsRow label="主题模式" description="跟随系统时，会使用设备当前的浅色或深色外观。">
                <Select aria-label="主题模式" selectedKey={mode} size="sm" className="w-36 shrink-0"
                  onSelectionChange={(key) => {
                    if (key === "system" || key === "light" || key === "dark") {
                      setMode(key); setErrors({}); setConflicts([]); setStatus("");
                    }
                  }}>
                  {modeOptions.map((option) => <SelectItem key={option.id} id={option.id} textValue={option.label}>{option.label}</SelectItem>)}
                </Select>
              </SettingsRow>
              <SettingsRow label="当前显示" description="跟随系统时显示当前实际应用的主题。">
                <span className="shrink-0 text-body-regular text-text-primary">{currentTheme === "dark" ? "深色" : "浅色"}</span>
              </SettingsRow>
            </SettingsCard>
          </section>

          <section className="flex flex-col gap-2" aria-label="强调色">
            <SettingsSectionLabel>强调色</SettingsSectionLabel>
            <SettingsCard>
              <div className="flex min-w-0 flex-col gap-3 py-3 pe-2.5">
                <div className="flex flex-col gap-1">
                  <p className="text-body-regular text-text-primary">强调色</p>
                  <p className="text-body-2-regular text-text-secondary">用于选中状态、焦点和强调控件。</p>
                </div>
                <AccentColorOptions value={accent} onChange={(value) => { setAccent(value); setErrors({}); setConflicts([]); setStatus(""); }} />
              </div>
            </SettingsCard>
          </section>

          <p className="text-body-2-regular text-text-secondary">选择会先保留为草稿；保存后立即应用，取消会丢弃草稿并保留已保存外观。</p>
          {updated && dirty && <div role="status" className="flex flex-col gap-2 rounded-xl border border-border-button-default p-3">
            <p className="text-body-2-regular text-text-secondary">已保存的外观在其他位置更新。当前草稿仍保留；保存时会检查冲突。</p>
            <Button variant="secondary" size="small" className="self-start" onClick={loadCurrent}>放弃草稿并载入最新值</Button>
          </div>}
          {!storageAvailable && <div className="flex flex-col gap-2 rounded-xl border border-border-error-default p-3">
            <p className="text-body-2-regular text-text-error-primary" role="alert">{notice || "当前外观尚未保存到本机。"}</p>
            <Button variant="secondary" size="small" className="self-start" onClick={retry}>重试保存当前外观</Button>
          </div>}
          {errors.form && <p role="alert" className="text-body-regular text-text-error-primary">{errors.form}</p>}
          {conflicts.length > 0 && <div className="flex flex-col gap-3 rounded-xl border border-border-error-default p-3" aria-label="解决外观冲突">
            <p className="text-body-2-regular text-text-secondary">主题模式或强调色已在其他位置更改。</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="small" onClick={loadCurrent}>载入最新值</Button>
              <Button size="small" onClick={() => save(true)}>使用我的更改保存</Button>
            </div>
          </div>}
          {status && <p role="status" className="text-body-regular text-text-secondary">{status}</p>}
          {dirty && <p className="text-body-2-regular text-text-tertiary">有未保存的更改。取消不会更改已保存外观。</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>取消</Button>
        <Button onClick={() => save()}>{storageAvailable ? "保存外观" : "重试并保存外观"}</Button>
      </ModalFooter>
    </>
  );
}
