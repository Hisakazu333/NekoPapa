import type { ChatModelProfile } from "./chat-model-profile";

/**
 * Public API addresses of model vendors, for 设置 → 模型与 API → 服务商.
 * Choosing one fills the interface type, endpoint and the vendor's
 * conventional key variable; the record still stores only those three
 * values, so the vendor is read back from the endpoint (`vendorForEndpoint`)
 * and older records need no migration. No model ids are listed here: the
 * form asks the vendor's own `/models` for them.
 */
export interface ModelVendor {
  id: string;
  label: string;
  provider: Exclude<ChatModelProfile["provider"], "custom">;
  endpoint: string;
  /** Conventional key variable; empty for local servers that take none. */
  env: string;
  region: "international" | "china" | "local";
}

const vendor = (id: string, label: string, endpoint: string, env: string, region: ModelVendor["region"], provider: ModelVendor["provider"] = "compatible"): ModelVendor =>
  ({ id, label, provider, endpoint, env, region });

export const MODEL_VENDORS: readonly ModelVendor[] = [
  vendor("openai", "OpenAI", "https://api.openai.com/v1", "OPENAI_API_KEY", "international"),
  vendor("anthropic", "Anthropic", "https://api.anthropic.com/v1", "ANTHROPIC_API_KEY", "international", "anthropic"),
  vendor("gemini", "Google Gemini", "https://generativelanguage.googleapis.com/v1beta/openai", "GEMINI_API_KEY", "international"),
  vendor("openrouter", "OpenRouter", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "international"),
  vendor("groq", "Groq", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "international"),
  vendor("mistral", "Mistral", "https://api.mistral.ai/v1", "MISTRAL_API_KEY", "international"),
  vendor("xai", "xAI", "https://api.x.ai/v1", "XAI_API_KEY", "international"),
  vendor("together", "Together", "https://api.together.xyz/v1", "TOGETHER_API_KEY", "international"),
  vendor("fireworks", "Fireworks", "https://api.fireworks.ai/inference/v1", "FIREWORKS_API_KEY", "international"),
  vendor("deepseek", "DeepSeek", "https://api.deepseek.com/v1", "DEEPSEEK_API_KEY", "china"),
  vendor("dashscope", "阿里云百炼 · 通义千问", "https://dashscope.aliyuncs.com/compatible-mode/v1", "DASHSCOPE_API_KEY", "china"),
  vendor("moonshot", "月之暗面 Kimi", "https://api.moonshot.cn/v1", "MOONSHOT_API_KEY", "china"),
  vendor("zhipu", "智谱 GLM", "https://open.bigmodel.cn/api/paas/v4", "ZHIPUAI_API_KEY", "china"),
  vendor("ark", "火山方舟 · 豆包", "https://ark.cn-beijing.volces.com/api/v3", "ARK_API_KEY", "china"),
  vendor("siliconflow", "硅基流动", "https://api.siliconflow.cn/v1", "SILICONFLOW_API_KEY", "china"),
  vendor("minimax", "MiniMax", "https://api.minimaxi.com/v1", "MINIMAX_API_KEY", "china"),
  vendor("qianfan", "百度千帆", "https://qianfan.baidubce.com/v2", "QIANFAN_API_KEY", "china"),
  vendor("hunyuan", "腾讯混元", "https://api.hunyuan.cloud.tencent.com/v1", "HUNYUAN_API_KEY", "china"),
  vendor("stepfun", "阶跃星辰", "https://api.stepfun.com/v1", "STEPFUN_API_KEY", "china"),
  vendor("yi", "零一万物", "https://api.lingyiwanwu.com/v1", "YI_API_KEY", "china"),
  vendor("ollama", "Ollama（本机）", "http://127.0.0.1:11434/v1", "", "local"),
  vendor("lmstudio", "LM Studio（本机）", "http://127.0.0.1:1234/v1", "", "local"),
];

export const CUSTOM_VENDOR = "custom";

const normalize = (endpoint: string) => endpoint.trim().replace(/\/+$/, "").toLowerCase()
  .replace("://localhost:", "://127.0.0.1:");

/** The preset whose address this endpoint is, else "custom". */
export function vendorForEndpoint(endpoint: string): string {
  const target = normalize(String(endpoint || ""));
  return MODEL_VENDORS.find((entry) => normalize(entry.endpoint) === target)?.id ?? CUSTOM_VENDOR;
}

/** Other official hosts a vendor answers on (its international site, say). */
const HOST_ALIASES: Record<string, readonly string[]> = {
  zhipu: ["api.z.ai"],
  dashscope: ["dashscope-intl.aliyuncs.com"],
  moonshot: ["api.moonshot.ai"],
};

const hostOf = (endpoint: string) => {
  try {
    const url = new URL(endpoint.trim());
    const host = url.hostname.toLowerCase().replace(/^localhost$/, "127.0.0.1");
    return { host, port: url.port };
  } catch {
    return undefined;
  }
};

/**
 * The vendor whose service this endpoint reaches, judged by host alone so a
 * path written with or without the version segment (`api.deepseek.com` and
 * `api.deepseek.com/v1`) is the same service. Local servers also match the
 * port. Unknown hosts (gateways, self-hosted servers) give undefined: their
 * parameters are their own, not the original vendor's.
 */
export function serviceVendor(endpoint: string | undefined): string | undefined {
  const target = hostOf(String(endpoint ?? ""));
  if (!target) return undefined;
  return MODEL_VENDORS.find((entry) => {
    const preset = hostOf(entry.endpoint)!;
    if (entry.region === "local") return preset.host === target.host && preset.port === target.port;
    return preset.host === target.host || (HOST_ALIASES[entry.id] ?? []).includes(target.host);
  })?.id;
}

export function modelVendor(id: string): ModelVendor | undefined {
  return MODEL_VENDORS.find((entry) => entry.id === id);
}
