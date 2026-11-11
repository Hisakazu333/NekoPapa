import type { ConfigurationRecord } from "../settings/configuration-types";
import { connectionModelIds } from "./model-connection-models";
import { chatModelProfile } from "./chat-model-profile";
import { modelVendor, vendorForEndpoint } from "./model-vendors";

export interface ComposerModelOption {
  id: string;
  name: string;
  model: string;
  /** The picker's group: the vendor whose public address the profile uses, else its interface type. */
  provider: string;
  /** Vendor preset id when the endpoint is a known vendor's address. */
  vendor?: string;
  runtime: boolean;
  connectionId?: string;
}
export interface ComposerRuntimeModel { model?: string | null; provider?: string | null }

const providerNames: Record<string, string> = { compatible: "OpenAI 兼容接口", anthropic: "Anthropic", custom: "其他接口" };
/** Every provider type a model profile can use, in the order the model picker lists them. */
export const composerProviderTypes: readonly string[] = Object.values(providerNames);

/** Use configured records, never a decorative catalog of provider model names. */
export function composerModels(records: readonly ConfigurationRecord[], runtime: ComposerRuntimeModel): ComposerModelOption[] {
  const result: ComposerModelOption[] = runtime.model ? [{
    id: "runtime", name: runtime.model, model: runtime.model, provider: runtime.provider || "当前服务", runtime: true,
  }] : [];
  for (const record of records) {
    const ids = connectionModelIds(record.values);
    const vendor = modelVendor(vendorForEndpoint(String(record.values.endpoint ?? "")));
    for (const [index, model] of ids.entries()) {
      result.push({ id: index === 0 ? record.id : `${record.id}:${model}`, connectionId: record.id,
        name: ids.length === 1 ? String(record.values.name || model) : model, model,
        provider: vendor?.label ?? (providerNames[String(record.values.provider)] || "其他接口"),
        ...(vendor ? { vendor: vendor.id } : {}), runtime: false });
    }
  }
  return result;
}

export function filterComposerModels(options: readonly ComposerModelOption[], query: string, provider?: string) {
  const term = query.trim().toLocaleLowerCase();
  return options.filter((option) => (!provider || option.provider === provider)
    && (!term || `${option.name} ${option.model} ${option.provider}`.toLocaleLowerCase().includes(term)));
}

/** A saved profile answers through the chat runtime; one that cannot (removed, invalid) blocks sending. */
export function composerModelBlockReason(selectedId: string | undefined, options: readonly ComposerModelOption[], records: readonly ConfigurationRecord[] = []) {
  if (!selectedId || selectedId === "runtime") return undefined;
  const option = options.find((item) => item.id === selectedId);
  const record = records.find((entry) => entry.id === (option?.connectionId ?? option?.id));
  return option && record ? chatModelProfile(record, option.model).reason : "所选模型配置已移除，请重新选择。";
}
