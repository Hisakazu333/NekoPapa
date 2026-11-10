import { useState } from "react";
import { canPickFolder, folderPickerError, pickProjectFolder } from "@/app/native-folder-picker";
import type { ConfigurationField, ConfigurationValue, ConfigurationValues } from "@/app/configuration-types";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NumberField } from "@/components/base/number-field/number-field";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Select, SelectItem } from "@/components/base/select/select";
import { Slider } from "@/components/base/slider/slider";
import { Switch } from "@/components/base/switch/switch";
import { Textarea } from "@/components/base/textarea/textarea";
import { cx } from "@/utils/cx";
import { SettingsRow } from "./settings-rows";
import { TagsControl } from "./settings-tags-control";

/**
 * Schema-driven settings rows in the BoardUI settings-modal recipe: each field
 * is one SettingsRow with the label and description on the left and a compact
 * control on the right. Long text and tag lists stack under the label. The
 * caller wraps rows in SettingsCard, one card per schema block.
 */

interface SettingsFieldsProps {
  fields: readonly ConfigurationField[];
  values: ConfigurationValues;
  errors: Record<string, string>;
  onChange: (key: string, value: ConfigurationValue) => void;
  prefix: string;
  stacked?: boolean;
}

/** Compact white select trigger used by the official settings rows. */
const SELECT_TRIGGER = "h-8 w-auto gap-1 rounded-lg px-2 py-1.5";

export function SettingsFields({ fields, values, errors, onChange, prefix, stacked }: SettingsFieldsProps) {
  return <>{fields.map((field) => <SettingsFieldRow key={field.key} field={field} id={`${prefix}-${field.key}`}
    value={values[field.key]} error={errors[field.key]} stacked={stacked} onChange={(next) => onChange(field.key, next)} />)}</>;
}

function SettingsFieldRow({ field, id, value, error, onChange, stacked: stackedRow = false }: {
  field: ConfigurationField;
  id: string;
  value: ConfigurationValue | undefined;
  error?: string;
  stacked?: boolean;
  onChange: (value: ConfigurationValue) => void;
}) {
  const control = field.control ?? defaultControl(field);
  const text = String(value ?? "");
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const optionHint = field.optionHints?.[text];
  const description = [field.hint, optionHint].filter(Boolean).join(" ");
  const aria = { "aria-labelledby": labelId, "aria-describedby": description || error ? descriptionId : undefined };
  const row = (children: React.ReactNode, stacked = stackedRow) => <SettingsRow label={field.label} description={description}
    error={error} labelId={labelId} descriptionId={descriptionId} stacked={stacked}>{children}</SettingsRow>;

  if (control === "switch") {
    return row(<Switch id={id} name={field.key} isSelected={value === true} onChange={onChange} {...aria} aria-invalid={Boolean(error)} />);
  }
  if (control === "select") {
    return row(<Select id={id} selectedKey={text} onSelectionChange={(key) => { if (typeof key === "string") onChange(key); }}
      triggerClassName={cx(SELECT_TRIGGER, error && "border-border-error-default")} className="shrink-0" {...aria}>
      {(field.options ?? []).map(([key, name]) => <SelectItem key={key} id={key} textValue={name}>{name}</SelectItem>)}
    </Select>);
  }
  if (control === "segmented") {
    return row(<SegmentedControl selectedKeys={[text]} className="shrink-0" variant="solid" {...aria}
      onSelectionChange={(keys) => { const next = Array.from(keys)[0]; if (typeof next === "string") onChange(next); }}>
      {(field.options ?? []).map(([key, name]) => <SegmentedControlItem key={key} id={key}>{name}</SegmentedControlItem>)}
    </SegmentedControl>);
  }
  if (control === "number") {
    const numeric = Number(value ?? field.initial);
    return row(<span className="flex shrink-0 items-center gap-2">
      <NumberField id={id} name={field.key} size="small" className="w-32" {...aria}
        value={Number.isFinite(numeric) ? numeric : Number(field.initial)} minValue={field.min} maxValue={field.max} step={field.step}
        isInvalid={Boolean(error)} onChange={(next) => onChange(next ?? field.initial)} />
      {field.unit && <span aria-hidden className="text-body-2-regular text-text-secondary">{field.unit.trim()}</span>}
    </span>);
  }
  if (control === "slider") {
    const numeric = Number(value ?? field.initial);
    return row(<Slider className="w-56 shrink-0" thumbLabel={field.label} {...aria}
      value={Number.isFinite(numeric) ? numeric : Number(field.initial)} minValue={field.min} maxValue={field.max} step={field.step}
      formatValue={(next) => field.unit ? `${next}${field.unit}` : `${next}×`} onChange={(next) => onChange(next)} />);
  }
  if (control === "directory") return row(<DirectoryControl id={id} value={text} placeholder={field.placeholder ?? "创建会话时选择"} aria={aria} onChange={onChange} />);
  if (control === "textarea") {
    return row(<Textarea id={id} name={field.key} value={text} onChange={onChange} maxLength={field.maxLength} rows={3}
      isRequired={field.required} validationBehavior="aria" isInvalid={Boolean(error)} {...aria} />, true);
  }
  if (control === "tags") return row(<TagsControl field={field} id={id} value={text} aria={aria} onChange={onChange} />, true);
  return row(<Input id={id} name={field.key} value={text} onChange={onChange} size="small" className={stackedRow ? "w-full" : "w-60 shrink-0"}
    type="text" spellCheck="false" placeholder={field.placeholder} autoComplete="off" maxLength={field.maxLength}
    isRequired={field.required} validationBehavior="aria" isInvalid={Boolean(error)} {...aria} />);
}

function defaultControl(field: ConfigurationField): NonNullable<ConfigurationField["control"]> {
  if (field.type === "boolean") return "switch";
  if (field.type === "number") return "number";
  if (field.type === "textarea") return "textarea";
  if (field.type === "select") return "select";
  return "input";
}

/**
 * A directory path. The desktop app fills it from the system folder picker
 * (full path); the browser preview cannot read a folder's path, so it is typed.
 */
function DirectoryControl({ id, value, placeholder, aria, onChange }: {
  id: string;
  value: string;
  placeholder: string;
  aria: Record<string, string | undefined>;
  onChange: (value: string) => void;
}) {
  const [error, setError] = useState("");
  const choose = async () => {
    try {
      const chosen = await pickProjectFolder(value || undefined);
      if (chosen) onChange(chosen);
      setError("");
    } catch (cause) {
      setError(`无法打开系统文件夹窗口：${folderPickerError(cause)}`);
    }
  };
  return <div className="flex shrink-0 flex-col items-end gap-1">
    <div className="flex items-center gap-2">
      <Input id={id} value={value} onChange={onChange} size="small" placeholder={placeholder} className="w-48" {...aria} />
      {canPickFolder() && <Button type="button" variant="secondary" size="small" onClick={() => void choose()}>选择</Button>}
    </div>
    {error && <p role="alert" className="max-w-64 text-caption-1-regular text-text-error-primary">{error}</p>}
  </div>;
}
