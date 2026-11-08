import { useId, useState } from "react";
import { RiArrowDownSLine, RiCheckLine } from "@remixicon/react";
import type { ConfigurationField, ConfigurationValue, ConfigurationValues } from "@/app/configuration-types";
import { Dropdown, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { Input } from "@/components/base/input/input";
import { Textarea } from "@/components/base/textarea/textarea";
import { Switch } from "@/components/base/switch/switch";
import { cx } from "@/utils/cx";

interface SettingsFieldsProps {
  fields: readonly ConfigurationField[];
  values: ConfigurationValues;
  errors: Record<string, string>;
  onChange: (key: string, value: ConfigurationValue) => void;
  prefix: string;
}

export function SettingsFields({ fields, values, errors, onChange, prefix }: SettingsFieldsProps) {
  return fields.map((field) => {
    const value = String(values[field.key] ?? "");
    const error = errors[field.key];
    const id = `${prefix}-${field.key}`;
    if (field.type === "boolean") {
      return <div key={field.key} className="flex flex-col gap-1.5">
        <Switch id={id} name={field.key} isSelected={values[field.key] === true}
          onChange={(next) => onChange(field.key, next)}
          aria-describedby={field.hint || error ? `${id}-description` : undefined} aria-invalid={Boolean(error)}>
          {field.label}
        </Switch>
        {(field.hint || error) && <p id={`${id}-description`} className={cx("text-body-2-regular", error ? "text-text-error-primary" : "text-text-tertiary")}>{error || field.hint}</p>}
      </div>;
    }
    if (field.type === "number") {
      return <div key={field.key} className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-body-medium text-text-primary">{field.label}</label>
        <input id={id} name={field.key} type="number" value={value}
          min={field.min} max={field.max} step={field.step} required={field.required}
          onChange={(event) => onChange(field.key, event.currentTarget.value)}
          aria-invalid={Boolean(error)} aria-describedby={field.hint || error ? `${id}-description` : undefined}
          className={cx("w-full rounded-2lg border-0 bg-background-tertiary-default px-3 py-2 text-body-regular text-text-primary outline-none ring-2 ring-inset ring-transparent focus:ring-border-button-active", error && "bg-background-tertiary-error ring-border-error-default")} />
        {(field.hint || error) && <p id={`${id}-description`} className={cx("text-body-2-regular", error ? "text-text-error-primary" : "text-text-tertiary")}>{error || field.hint}</p>}
      </div>;
    }
    if (field.type === "select") {
      return <SettingsChoice key={field.key} field={field} value={value} error={error}
        id={id} onChange={(next) => onChange(field.key, next)} />;
    }
    if (field.type === "textarea" || field.key === "command") {
      return <Textarea key={field.key} id={id} name={field.key}
        label={field.label} value={value} onChange={(next) => onChange(field.key, next)}
        maxLength={field.maxLength} rows={3} isRequired={field.required}
        validationBehavior="aria" isInvalid={Boolean(error)} hint={error || field.hint} />;
    }
    return <Input key={field.key} id={id} name={field.key}
      label={field.label} value={value} onChange={(next) => onChange(field.key, next)}
      type={field.format === "environment" ? "password" : "text"}
      autoComplete="off" autoFocus={field.key === "name"}
      maxLength={field.maxLength} isRequired={field.required}
      validationBehavior="aria" isInvalid={Boolean(error)} errorMessage={error} hint={field.hint} />;
  });
}

function SettingsChoice({ field, value, error, id, onChange }: {
  field: ConfigurationField;
  value: string;
  error?: string;
  id: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const description = useId();
  const label = field.options?.find(([key]) => key === value)?.[1] ?? "请选择";
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-body-medium text-text-primary">{field.label}</span>
      <Dropdown isOpen={open} onOpenChange={setOpen}>
        <DropdownTrigger id={id} name={field.key} aria-labelledby={`${id}-label`}
          aria-describedby={field.hint || error ? description : undefined} aria-invalid={Boolean(error)}
          className={cx("flex w-full items-center justify-between gap-2 rounded-2lg border border-border-button-default bg-background-full px-3 py-2 text-body-regular text-text-primary", error && "border-border-error-default")}>
          <span className="min-w-0 truncate">{label}</span>
          <RiArrowDownSLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
        </DropdownTrigger>
        <DropdownPopover aria-label={field.label} className="max-w-[calc(100vw-3rem)]">
          <DropdownGroup>
            {field.options?.map(([key, name]) => (
              <DropdownItem key={key} selected={key === value} onSelect={() => { onChange(key); setOpen(false); }}>
                <span className="min-w-0 flex-1">{name}</span>
                {key === value && <RiCheckLine className="size-4 shrink-0" aria-hidden />}
              </DropdownItem>
            ))}
          </DropdownGroup>
        </DropdownPopover>
      </Dropdown>
      {(field.hint || error) && <p id={description} className={cx("text-body-2-regular", error ? "text-text-error-primary" : "text-text-tertiary")}>{error || field.hint}</p>}
    </div>
  );
}
