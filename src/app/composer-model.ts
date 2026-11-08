import type { ConfigurationRecord } from "./configuration-types";

export interface ComposerModelOption {
  id: string;
  name: string;
  model: string;
  provider: string;
  runtime: boolean;
}
export interface ComposerRuntimeModel { model?: string | null; provider?: string | null }

const providerNames: Record<string, string> = { compatible: "OpenAI 兼容接口", anthropic: "Anthropic", custom: "其他接口" };

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

export function composerModelBlockReason(selectedId: string | undefined, options: readonly ComposerModelOption[]) {
  if (!selectedId || selectedId === "runtime") return undefined;
  const selected = options.find((option) => option.id === selectedId);
  return selected ? "模型已选好，等待模型服务接入。" : "所选模型配置已移除，请重新选择。";
}
