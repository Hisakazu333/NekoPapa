import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { configurationSchemas } from "@/app/configuration-contract";
import { saveConfigurationDraft } from "@/app/configuration-draft";
import type { ConfigurationGroup, ConfigurationValue, ConfigurationValues } from "@/app/configuration-types";
import { Button } from "@/components/base/buttons/button";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { toast } from "@/components/base/toast/toast";
import { useConfiguration } from "@/hooks/use-configuration";
import { CollectionSettingsPanel } from "./nekopapa-collection-settings";
import { SettingsFields } from "./nekopapa-settings-fields";
import { SettingsCard, SettingsSectionLabel } from "./settings-rows";
import { SettingsServiceStatus } from "./settings-service-status";
import { useSettingsDraft } from "./settings-draft-context";

type EditableGroup = Exclude<ConfigurationGroup, "profile" | "appearance">;
export interface ConfigurationGroupPanelProps {
  group: EditableGroup;
  onClose: () => void;
  /** Page-specific content shown above the service status, e.g. the General profile card. */
  lead?: ReactNode;
}
const equal = (left: ConfigurationValues, right: ConfigurationValues) => JSON.stringify(left) === JSON.stringify(right);

/** Each mounted instance owns one category's draft until save or cancellation. */
export function ConfigurationGroupPanel({ group, onClose, lead }: ConfigurationGroupPanelProps) {
  const { store, data, storageAvailable, notice, refresh } = useConfiguration();
  const schema = configurationSchemas.find((entry) => entry.id === group)!;
  const [base, setBase] = useState(() => ({ ...data.groups[group] }));
  const [values, setValues] = useState(base);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const formId = useId();
  const dirty = !equal(values, base);
  const clearDraft = useSettingsDraft(group, dirty);
  const updated = !equal(data.groups[group], base);
  const fields = store.fields(group);
  useEffect(() => {
    if (!dirty && updated) {
      const current = { ...data.groups[group] };
      setBase(current);
      setValues(current);
    }
  }, [data, dirty, group, updated]);

  const loadCurrent = () => {
    const current = { ...store.data.groups[group] };
    setBase(current);
    setValues(current);
    setErrors({});
    setConflicts([]);
    setStatus("已载入当前保存的配置。");
  };
  const update = (key: string, value: ConfigurationValue) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "", form: "" }));
    setConflicts([]);
    setStatus("");
  };
  const save = (overwrite = false) => {
    const result = saveConfigurationDraft(store, group, values, base, overwrite);
    refresh();
    setErrors(result.errors);
    setConflicts(result.conflicts);
    if (!result.saved) {
      setStatus("");
      const field = Object.keys(result.errors).find((key) => key !== "form");
      if (field) requestAnimationFrame(() => {
        const target = document.getElementById(`${formId}-${field}`);
        (target?.matches("input, textarea, button") ? target : target?.querySelector<HTMLElement>("input, textarea, button"))?.focus();
      });
      return;
    }
    setBase(result.values);
    setValues(result.values);
    setStatus("");
    toast.success(schema.effect === "immediate" ? "设置已保存" : "默认配置已保存",
      schema.effect === "runtime" ? { description: "对应执行服务尚未接入，保存不会启动进程或申请权限。" } : undefined);
  };
  const submit = (event: FormEvent) => { event.preventDefault(); save(); };
  const retry = () => {
    const saved = store.persist();
    refresh();
    setErrors(saved ? {} : { form: store.notice });
    if (saved) setStatus("当前窗口中的配置已保存到本机。表单中尚未提交的草稿仍然保留。");
  };
  const cancel = () => { loadCurrent(); clearDraft(); onClose(); };

  return (
    <>
      <ModalBody>
        <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-6">
          {lead}
          <SettingsServiceStatus runtime={schema.effect === "runtime"} scope={schema.scope} />
          {updated && dirty && <div role="status" className="flex flex-col gap-2 rounded-xl border border-border-button-default p-3">
            <p className="text-body-2-regular text-text-secondary">本机配置已在其他位置更新。你的草稿仍然保留；保存时只合并你编辑的字段，并检查冲突。</p>
            <Button variant="secondary" size="small" className="self-start" onClick={loadCurrent}>放弃草稿并载入最新值</Button>
          </div>}
          {schema.blocks.map((block) => <section key={block.title} className="flex flex-col gap-2" aria-label={block.title}>
            <SettingsSectionLabel>{block.title}</SettingsSectionLabel>
            <SettingsCard>
              <SettingsFields fields={block.fields.map((field) => fields.find((current) => current.key === field.key)!)} values={values} errors={errors} onChange={update} prefix={formId} />
            </SettingsCard>
          </section>)}
          {!storageAvailable && <div className="flex flex-col gap-2 rounded-xl border border-border-error-default p-3">
            <p className="text-body-2-regular text-text-error-primary" role="alert">{notice || "当前配置尚未保存到本机。"}</p>
            <Button variant="secondary" size="small" className="self-start" onClick={retry}>重试保存当前配置</Button>
          </div>}
          {errors.form && <p role="alert" className="text-body-regular text-text-error-primary">{errors.form}</p>}
          {conflicts.length > 0 && <div className="flex flex-col gap-3 rounded-xl border border-border-error-default p-3" aria-label="解决设置冲突">
            <p className="text-body-2-regular text-text-secondary">冲突字段：{conflicts.map((key) => fields.find((field) => field.key === key)?.label ?? key).join("、")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="small" onClick={loadCurrent}>载入最新值</Button>
              <Button size="small" onClick={() => save(true)}>使用我的更改保存</Button>
            </div>
          </div>}
          {status && <p role="status" className="text-body-regular text-text-secondary">{status}</p>}
          <p className="text-body-2-regular text-text-tertiary">{dirty ? "有未保存的更改。切换分类会保留本次草稿。" : "当前表单与已读取的配置一致。"}</p>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={cancel}>取消</Button>
        <Button type="submit" form={formId}>{storageAvailable ? "保存设置" : "重试并保存设置"}</Button>
      </ModalFooter>
    </>
  );
}

export function ConnectionsSettingsPanel({ onClose }: { onClose: () => void }) {
  return <CollectionSettingsPanel collection="connections" onClose={onClose} />;
}

export function HooksSettingsPanel({ onClose }: { onClose: () => void }) {
  return <CollectionSettingsPanel collection="hooks" onClose={onClose} />;
}
