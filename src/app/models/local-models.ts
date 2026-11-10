/**
 * Local inference servers (Ollama, LM Studio, llama.cpp, vLLM, Jan) found on
 * this computer. The app owns the catalog and the parsing; the desktop host
 * (`probe_local_models` in src-tauri/src/local_models.rs) or, in the browser
 * preview, the dev server (scripts/local-models-api.ts) only fetches the
 * listed paths from 127.0.0.1 and hands the raw reply back.
 */

export type LocalRuntimeId = "ollama" | "lmstudio" | "llamacpp" | "vllm" | "jan";

export interface LocalRuntime {
  id: LocalRuntimeId;
  name: string;
  port: number;
  /** Where the model list lives: Ollama's own API, or the OpenAI-compatible one. */
  path: "/api/tags" | "/v1/models";
  /** Shown under the name. */
  hint: string;
  site: string;
}

export const LOCAL_RUNTIMES: readonly LocalRuntime[] = [
  { id: "ollama", name: "Ollama", port: 11434, path: "/api/tags", hint: "默认端口 11434。", site: "https://ollama.com/download" },
  { id: "lmstudio", name: "LM Studio", port: 1234, path: "/v1/models", hint: "在 LM Studio 的“开发者”页启动本地服务器，默认端口 1234。", site: "https://lmstudio.ai" },
  { id: "llamacpp", name: "llama.cpp", port: 8080, path: "/v1/models", hint: "llama-server 默认端口 8080；该端口上的其他兼容服务也会显示在这里。", site: "https://github.com/ggml-org/llama.cpp" },
  { id: "vllm", name: "vLLM", port: 8000, path: "/v1/models", hint: "vllm serve 默认端口 8000；该端口上的其他兼容服务也会显示在这里。", site: "https://docs.vllm.ai" },
  { id: "jan", name: "Jan", port: 1337, path: "/v1/models", hint: "在 Jan 设置中开启本地 API 服务器，默认端口 1337。", site: "https://jan.ai" },
];

export const LOCAL_PROBE_PATHS = ["/api/tags", "/v1/models"] as const;

/** What a host sends back for one target. */
export interface LocalProbe {
  port: number;
  path: string;
  /** Something answered on the port. */
  reachable: boolean;
  status?: number;
  body?: string;
  error?: string;
}

/** Keeps only well-formed probe entries; anything else reads as "not found". */
export function readLocalProbes(value: unknown): LocalProbe[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): LocalProbe[] => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    if (!Number.isInteger(item.port) || typeof item.path !== "string" || typeof item.reachable !== "boolean") return [];
    return [{
      port: item.port as number, path: item.path, reachable: item.reachable,
      ...(Number.isInteger(item.status) ? { status: item.status as number } : {}),
      ...(typeof item.body === "string" ? { body: item.body } : {}),
      ...(typeof item.error === "string" ? { error: item.error.slice(0, 200) } : {}),
    }];
  });
}

export interface LocalModel { id: string; detail?: string }

export type LocalRuntimeState =
  | { kind: "running"; models: LocalModel[] }
  | { kind: "offline" }
  | { kind: "unexpected"; reason: string };

const MODEL_LIMIT = 200;
const text = (value: unknown, limit = 160) => typeof value === "string" ? value.trim().slice(0, limit) : "";

function gigabytes(bytes: unknown) {
  return typeof bytes === "number" && Number.isFinite(bytes) && bytes > 0 ? `${(bytes / 1e9).toFixed(1)} GB` : "";
}

/** Reads one probe into what the settings page shows. */
export function readLocalRuntime(runtime: LocalRuntime, probe: LocalProbe | undefined): LocalRuntimeState {
  if (!probe || !probe.reachable) return { kind: "offline" };
  if (probe.status !== 200) return { kind: "unexpected", reason: probe.status ? `端口 ${runtime.port} 有服务响应，但返回 HTTP ${probe.status}。` : probe.error ?? `端口 ${runtime.port} 有服务，但没有返回模型列表。` };
  let raw: unknown;
  try { raw = JSON.parse(probe.body ?? ""); } catch { return { kind: "unexpected", reason: `端口 ${runtime.port} 上的服务没有返回模型列表，可能不是 ${runtime.name}。` }; }
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = runtime.path === "/api/tags" ? value.models : value.data;
  if (!Array.isArray(list)) return { kind: "unexpected", reason: `端口 ${runtime.port} 上的服务没有返回模型列表，可能不是 ${runtime.name}。` };
  const models: LocalModel[] = [];
  const seen = new Set<string>();
  for (const entry of list.slice(0, MODEL_LIMIT)) {
    const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const id = runtime.path === "/api/tags" ? text(item.name) || text(item.model) : text(item.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const details = (item.details && typeof item.details === "object" ? item.details : {}) as Record<string, unknown>;
    const detail = [text(details.parameter_size, 20), text(details.quantization_level, 20), gigabytes(item.size)].filter(Boolean).join(" · ");
    models.push(detail ? { id, detail } : { id });
  }
  return { kind: "running", models };
}

/** The OpenAI-compatible base address a chat client uses for this server. */
export function localApiBase(runtime: LocalRuntime) {
  return `http://127.0.0.1:${runtime.port}/v1`;
}

/** Values for a 自定义 API record pointing at a local model; local servers need no key. */
export function localModelRecord(runtime: LocalRuntime, model: string) {
  return { name: `${runtime.name} · ${model}`.slice(0, 72), provider: "compatible", endpoint: localApiBase(runtime), model: model.slice(0, 160), environment: "" };
}
