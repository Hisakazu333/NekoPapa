import { useEffect, useState } from "react";
import { ListIcon } from "@/components/foundations/icons/app-icons";
import { isCredentialName, keychainRef, keySourceOf, type KeySource } from "@/app/chat-model-profile";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { canStoreKeys, DRAFT_KEY_ID, storedModelKeys, storeModelKey } from "./model-key-store";
import type { ConfigurationField, ConfigurationValue, ConfigurationValues } from "@/app/configuration-types";
import { CUSTOM_VENDOR, MODEL_VENDORS, modelVendor, vendorForEndpoint, type ModelVendor } from "@/app/model-vendors";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { cx } from "@/utils/cx";
import { SettingsFields } from "./nekopapa-settings-fields";
import { SettingsRow } from "./settings-rows";
import { useModelList } from "./use-model-tests";

/**
 * The 模型与 API editor. A 服务商 preset fills the interface type, the
 * vendor's public endpoint and its conventional key variable; the model id
 * comes from the server's own list (获取模型列表) or is typed. Only the
 * schema's fields are stored — the vendor is read back from the endpoint.
 *
 * 密钥来源: an API Key typed here goes to the system keychain when the
 * record is saved (desktop app only) and is never kept in the form values;
 * or the record names an environment variable; or the server takes none.
 */

interface ModelProfileFieldsProps {
  fields: readonly ConfigurationField[];
  values: ConfigurationValues;
  errors: Record<string, string>;
  onChange: (key: string, value: ConfigurationValue) => void;
  prefix: string;
  /** The saved record being edited, if any; its stored key is kept unless a new one is typed. */
  recordId?: string;
  /** The API Key typed in this form, held by the form's owner until it is saved. */
  secret: string;
  onSecretChange: (secret: string) => void;
}

const SELECT_TRIGGER = "h-8 w-auto gap-1 rounded-lg px-2 py-1.5";
const REGION: Record<ModelVendor["region"], string> = { international: "国际", china: "国内", local: "本机" };
/** Changing any of these makes a fetched list stale. */
const LIST_KEYS = new Set(["provider", "endpoint", "environment", "keySource"]);
const SOURCES: [KeySource, string][] = [["keychain", "API Key"], ["environment", "环境变量"], ["none", "不需要"]];

export function ModelProfileFields({ fields, values, errors, onChange, prefix, recordId, secret, onSecretChange }: ModelProfileFieldsProps) {
  const [vendor, setVendor] = useState(() => vendorForEndpoint(String(values.endpoint ?? "")));
  const modelList = useModelList();
  const current = modelVendor(vendor);
  const environment = String(values.environment ?? "").trim();
  const source = keySourceOf({ values });
  const desktop = canStoreKeys();
  const [stored, setStored] = useState(false);
  useEffect(() => {
    let live = true;
    if (recordId) void storedModelKeys([recordId]).then((ids) => { if (live) setStored(ids.has(recordId)); });
    return () => { live = false; };
  }, [recordId]);

  // The key the list request uses: one typed just now goes to the keychain
  // as a draft first, so it never travels in a request body.
  const fetchModels = async () => {
    let credential = "";
    if (source === "environment") credential = environment;
    else if (source === "keychain") {
      if (!desktop) { modelList.fail("浏览器预览无法访问系统钥匙串。请选择环境变量，或在桌面应用中使用这份配置。"); return; }
      if (secret.trim()) {
        try { await storeModelKey(DRAFT_KEY_ID, secret); } catch (error) { modelList.fail(error instanceof Error ? error.message : "无法访问钥匙串。"); return; }
        credential = keychainRef(DRAFT_KEY_ID);
      } else if (recordId && stored) credential = keychainRef(recordId);
      else { modelList.fail("请先填写 API Key。"); return; }
    }
    void modelList.list({ provider: values.provider, endpoint: values.endpoint, credential });
  };

  const change = (key: string, value: ConfigurationValue) => {
    onChange(key, value);
    if (LIST_KEYS.has(key)) modelList.clear();
    if (key === "endpoint") setVendor(vendorForEndpoint(String(value)));
  };
  const choose = (id: string) => {
    const next = modelVendor(id);
    setVendor(id);
    modelList.clear();
    if (!next) return; // 自定义 keeps whatever was typed.
    onChange("provider", next.provider);
    onChange("endpoint", next.endpoint);
    // Values the user typed stay; ones the previous preset filled follow the new one.
    if (!environment || environment === current?.env) onChange("environment", next.env);
    // Local servers take no key; a hosted vendor needs one.
    if (next.region === "local") onChange("keySource", "none");
    else if (source === "none") onChange("keySource", desktop ? "keychain" : "environment");
    const name = String(values.name ?? "").trim();
    if (!name || name === current?.label) onChange("name", next.label);
  };

  const byKey = (key: string) => fields.find((field) => field.key === key);
  const envHint = isCredentialName(environment)
    ? desktop ? "填写变量名后，从已设置该变量的终端启动 NekoPapa。"
      : `只填变量名。在启动开发服务器的终端运行 export ${environment}=你的密钥，再重启开发服务器。`
    : current?.region === "local" ? "本机服务通常不需要密钥，可留空。" : byKey("environment")?.hint;
  const upper = ["name", "provider", "endpoint"].map(byKey).filter((field): field is ConfigurationField => Boolean(field));
  const credential = byKey("environment");
  const vendorHint = current
    ? `${REGION[current.region]} · 已填入接口类型、服务地址${current.env ? `和 ${current.env}` : ""}，可再修改。`
    : "选择常用服务商自动填写；其他 OpenAI 兼容服务选“自定义”，手动填写地址。";

  return <>
    <SettingsRow label="服务商" description={vendorHint} labelId={`${prefix}-vendor-label`} descriptionId={`${prefix}-vendor-description`}>
      <Select id={`${prefix}-vendor`} selectedKey={vendor} onSelectionChange={(key) => { if (typeof key === "string") choose(key); }}
        triggerClassName={SELECT_TRIGGER} className="shrink-0" aria-labelledby={`${prefix}-vendor-label`} aria-describedby={`${prefix}-vendor-description`}>
        {[...MODEL_VENDORS.map((entry) => <SelectItem key={entry.id} id={entry.id} textValue={entry.label}>
          <span className="flex w-full items-center justify-between gap-3"><span>{entry.label}</span><span className="text-caption-1-regular text-text-tertiary">{REGION[entry.region]}</span></span>
        </SelectItem>), <SelectItem key={CUSTOM_VENDOR} id={CUSTOM_VENDOR} textValue="自定义">自定义</SelectItem>]}
      </Select>
    </SettingsRow>
    <SettingsFields fields={upper} values={values} errors={errors} onChange={change} prefix={prefix} />
    <KeySourceRow prefix={prefix} value={source} onChange={(next) => { change("keySource", next); }} />
    {source === "keychain" && desktop && <KeyRow prefix={prefix} secret={secret} stored={stored} error={errors.secret}
      onChange={(next) => { onSecretChange(next); modelList.clear(); }} />}
    {source === "environment" && credential && <SettingsFields fields={[{ ...credential, hint: envHint ?? "" }]} values={values} errors={errors} onChange={change} prefix={prefix} />}
    <ModelRow prefix={prefix} value={String(values.model ?? "")} error={errors.model} hint={byKey("model")?.hint}
      list={modelList.state} onFetch={() => void fetchModels()} onChange={(next) => onChange("model", next)} />
    {byKey("contextWindow") && <SettingsFields fields={[byKey("contextWindow")!]} values={values} errors={errors} onChange={change} prefix={prefix} />}
  </>;
}

function ModelRow({ prefix, value, error, hint, list, onFetch, onChange }: {
  prefix: string;
  value: string;
  error?: string;
  hint?: string;
  list: ReturnType<typeof useModelList>["state"];
  onFetch: () => void;
  onChange: (value: string) => void;
}) {
  const id = `${prefix}-model`;
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const description = [hint, "也可以点“获取模型列表”，从服务返回的模型中选择。"].filter(Boolean).join(" ");
  return <SettingsRow label="模型标识" description={description} error={error} labelId={labelId} descriptionId={descriptionId} stacked>
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input id={id} name="model" value={value} onChange={onChange} size="small" className="min-w-48 flex-1" autoComplete="off" maxLength={160}
          isRequired validationBehavior="aria" isInvalid={Boolean(error)} aria-labelledby={labelId} aria-describedby={descriptionId} />
        <Button type="button" variant="secondary" size="small" leadingIcon={ListIcon} disabled={list?.pending} onClick={onFetch}>
          {list?.pending ? "正在获取…" : "获取模型列表"}
        </Button>
      </div>
      {list && !list.pending && list.models.length > 0 && <Select aria-label="从服务返回的模型中选择" selectedKey={list.models.includes(value) ? value : null}
        onSelectionChange={(key) => { if (typeof key === "string") onChange(key); }} placeholder={`从 ${list.models.length} 个模型中选择`}
        triggerClassName={SELECT_TRIGGER} className="self-start">
        {list.models.map((model) => <SelectItem key={model} id={model} textValue={model}>{model}</SelectItem>)}
      </Select>}
      {list && <p role="status" className={cx("text-body-2-regular", list.pending ? "text-text-tertiary" : list.ok ? "text-text-secondary" : "text-text-error-primary")}>{list.message}</p>}
    </div>
  </SettingsRow>;
}

function KeySourceRow({ prefix, value, onChange }: { prefix: string; value: KeySource; onChange: (value: KeySource) => void }) {
  const desktop = canStoreKeys();
  const description = value === "none" ? "本机服务（Ollama、LM Studio 等）通常不需要密钥。"
    : !desktop ? "浏览器预览由开发服务器读取环境变量。直接粘贴 API Key 请使用桌面应用，密钥会存入系统钥匙串。"
    : value === "keychain" ? "直接填写服务商给你的 API Key，保存后存入系统钥匙串，不写入设置或备份。"
    : "从启动 NekoPapa 的终端环境读取密钥。";
  return <SettingsRow label="密钥来源" description={description} labelId={`${prefix}-key-source-label`} descriptionId={`${prefix}-key-source-description`}>
    <SegmentedControl selectedKeys={[value]} className="shrink-0" aria-labelledby={`${prefix}-key-source-label`} aria-describedby={`${prefix}-key-source-description`}
      onSelectionChange={(keys) => { const next = Array.from(keys)[0]; if (typeof next === "string") onChange(next as KeySource); }}>
      {SOURCES.map(([id, label]) => <SegmentedControlItem key={id} id={id} isDisabled={id === "keychain" && !desktop}>{label}</SegmentedControlItem>)}
    </SegmentedControl>
  </SettingsRow>;
}

function KeyRow({ prefix, secret, stored, error, onChange }: { prefix: string; secret: string; stored: boolean; error?: string; onChange: (value: string) => void }) {
  const id = `${prefix}-secret`;
  const description = stored
    ? "已保存在钥匙串。留空保留原密钥；填写新的会替换它。"
    : "例如 sk-…；只保存在本机钥匙串，发送请求时由桌面应用填入。";
  return <SettingsRow label="API Key" description={description} error={error} labelId={`${id}-label`} descriptionId={`${id}-description`}>
    <Input id={id} name="api-key" value={secret} onChange={onChange} size="small" className="w-60 shrink-0" type="password"
      autoComplete="off" placeholder={stored ? "••••••••（已保存）" : "粘贴 API Key"} maxLength={4096}
      isInvalid={Boolean(error)} aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} />
  </SettingsRow>;
}
