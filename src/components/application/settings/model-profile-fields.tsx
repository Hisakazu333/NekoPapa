import { useEffect, useState, type ReactNode } from "react";
import { Button as AriaButton, Disclosure, DisclosurePanel } from "react-aria-components";
import { ChevronDownIcon } from "@/components/foundations/icons/app-icons";
import { isCredentialName, keychainRef, keySourceOf, type KeySource } from "@/app/models/chat-model-profile";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { canStoreKeys, DRAFT_KEY_ID, storedModelKeys, storeModelKey } from "./model-key-store";
import type { ConfigurationField, ConfigurationValue, ConfigurationValues } from "@/app/settings/configuration-types";
import { CUSTOM_VENDOR, MODEL_VENDORS, modelVendor, vendorForEndpoint, type ModelVendor } from "@/app/models/model-vendors";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { SettingsFields } from "./nekopapa-settings-fields";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";
import { connectionModelIds } from "@/app/models/model-connection-models";
import { ModelSelectionFields } from "./model-selection-fields";
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

  const getCredential = async () => {
    if (source === "environment") return environment;
    if (source === "none") return "";
    if (!desktop) throw new Error("浏览器预览无法读取钥匙串。请选择环境变量，或在桌面应用中打开这份配置。");
    if (secret.trim()) {
      await storeModelKey(DRAFT_KEY_ID, secret);
      return keychainRef(DRAFT_KEY_ID);
    }
    if (recordId && stored) return keychainRef(recordId);
    throw new Error("请先填写 API Key。");
  };

  const change = (key: string, value: ConfigurationValue) => {
    onChange(key, value);
    if (LIST_KEYS.has(key)) modelList.clear();
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
  };

  const byKey = (key: string) => fields.find((field) => field.key === key);
  const envHint = isCredentialName(environment)
    ? desktop ? "填写变量名后，从已设置该变量的终端启动 NekoPapa。"
      : `只填变量名。在启动开发服务器的终端运行 export ${environment}=你的密钥，再重启开发服务器。`
    : current?.region === "local" ? "本机服务通常不需要密钥，可留空。" : byKey("environment")?.hint;
  const connection = ["provider", "endpoint"].map(byKey).filter((field): field is ConfigurationField => Boolean(field));
  const extras = ["name", "contextWindow"].map(byKey).filter((field): field is ConfigurationField => Boolean(field))
    .map((field) => field.key === "name" ? { ...field, required: false, hint: "给这份连接起个名字，留空时使用默认模型的标识。" } : field);
  const credential = byKey("environment");
  const fieldProps = { values, errors, onChange: change, prefix };
  const vendorHint = current ? "已填入常用连接参数，可在连接详情中修改。" : "选一个服务商填入常用参数，或手动填写自定义地址。";

  return <div className="flex flex-col gap-4">
    <section aria-label="连接服务" className="flex flex-col gap-1">
      <SettingsSectionLabel>1. 连接服务</SettingsSectionLabel>
      <SettingsCard>
        <SettingsRow label="服务商" description={vendorHint} labelId={`${prefix}-vendor-label`} descriptionId={`${prefix}-vendor-description`}>
          <Select id={`${prefix}-vendor`} selectedKey={vendor} onSelectionChange={(key) => { if (typeof key === "string") choose(key); }}
            triggerClassName={SELECT_TRIGGER} className="shrink-0" aria-labelledby={`${prefix}-vendor-label`} aria-describedby={`${prefix}-vendor-description`}>
            {[...MODEL_VENDORS.map((entry) => <SelectItem key={entry.id} id={entry.id} textValue={entry.label}>
              <span className="flex w-full items-center justify-between gap-3"><span>{entry.label}</span><span className="text-caption-1-regular text-text-tertiary">{REGION[entry.region]}</span></span>
            </SelectItem>), <SelectItem key={CUSTOM_VENDOR} id={CUSTOM_VENDOR} textValue="自定义">自定义</SelectItem>]}
          </Select>
        </SettingsRow>
        {!current && <SettingsFields {...fieldProps} fields={connection} stacked />}
        <KeySourceRow prefix={prefix} value={source} onChange={(next) => { change("keySource", next); }} />
        {source === "keychain" && desktop && <KeyRow prefix={prefix} secret={secret} stored={stored} error={errors.secret}
          onChange={(next) => { onSecretChange(next); modelList.clear(); }} />}
        {source === "environment" && credential && <SettingsFields {...fieldProps}
          fields={[{ ...credential, label: "环境变量名", hint: envHint ?? "", placeholder: current?.env || "MODEL_API_KEY" }]} stacked />}
        {current && <ModelDetails title="连接详情" hasError={Boolean(errors.endpoint || errors.provider)}>
          <SettingsFields {...fieldProps} fields={connection} stacked />
        </ModelDetails>}
      </SettingsCard>
    </section>
    <section aria-label="添加模型" className="flex flex-col gap-1">
      <SettingsSectionLabel>2. 添加模型</SettingsSectionLabel>
      <SettingsCard>
        <ModelSelectionFields prefix={prefix} selected={connectionModelIds(values)} error={errors.model || errors.additionalModels}
          list={modelList.state} onFetch={() => void modelList.list({ provider: values.provider, endpoint: values.endpoint }, getCredential)}
          onChange={([primary = "", ...additional]) => {
            if (values.model && primary !== values.model) onChange("contextWindow", 0);
            onChange("model", primary);
            onChange("additionalModels", additional.join("\n"));
          }} />
        <ModelDetails title="更多设置" hasError={Boolean(errors.name || errors.contextWindow)}>
          <SettingsFields {...fieldProps} fields={extras} stacked />
        </ModelDetails>
      </SettingsCard>
    </section>
  </div>;
}

function ModelDetails({ title, hasError, children }: { title: string; hasError: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Disclosure isExpanded={open || hasError} onExpandedChange={setOpen} className="group/model-details border-b border-separator-border last:border-b-0">
    <AriaButton slot="trigger" onFocus={() => { if (hasError) setOpen(true); }}
      className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg py-2.5 pe-2.5 text-start text-body-2-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
      <ChevronDownIcon className="size-4 -rotate-90 group-data-[expanded]/model-details:rotate-0" aria-hidden />{title}
    </AriaButton>
    <DisclosurePanel><div onFocusCapture={() => { if (hasError) setOpen(true); }}>{children}</div></DisclosurePanel>
  </Disclosure>;
}

function KeySourceRow({ prefix, value, onChange }: { prefix: string; value: KeySource; onChange: (value: KeySource) => void }) {
  const desktop = canStoreKeys();
  const description = value === "none" ? "本机服务（Ollama、LM Studio 等）通常不需要密钥。"
    : !desktop ? "浏览器预览由开发服务器读取环境变量。直接粘贴 API Key 请使用桌面应用，密钥会存入系统钥匙串。"
    : value === "keychain" ? "直接填写服务商给你的 API Key，保存后存入系统钥匙串，不写入设置或备份。"
    : "从启动 NekoPapa 的终端环境读取密钥。";
  return <SettingsRow label="密钥来源" stacked description={description} labelId={`${prefix}-key-source-label`} descriptionId={`${prefix}-key-source-description`}>
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
  return <SettingsRow label="API Key" description={description} error={error} labelId={`${id}-label`} descriptionId={`${id}-description`} stacked>
    <Input id={id} name="api-key" value={secret} onChange={onChange} size="small" className="w-full" type="password"
      autoComplete="off" placeholder={stored ? "••••••••（已保存）" : "粘贴 API Key"} maxLength={4096}
      isInvalid={Boolean(error)} aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} />
  </SettingsRow>;
}
