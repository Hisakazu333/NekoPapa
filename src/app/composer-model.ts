import type { ConfigurationRecord } from "./configuration-types";
import { chatModelProfile } from "./chat-model-profile";

export interface ComposerModelOption {
  id: string;
  name: string;
  model: string;
  provider: string;
  runtime: boolean;
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
    const model = String(record.values.model || "").trim();
    if (!model) continue;
    result.push({ id: record.id, name: String(record.values.name || model), model,
      provider: providerNames[String(record.values.provider)] || "其他接口", runtime: false });
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
  const record = options.some((option) => option.id === selectedId) ? records.find((entry) => entry.id === selectedId) : undefined;
  return record ? chatModelProfile(record).reason : "所选模型配置已移除，请重新选择。";
}
