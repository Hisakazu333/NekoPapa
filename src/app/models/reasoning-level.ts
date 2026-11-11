/**
 * 推理档位: the thinking levels a model documents, chosen on the model
 * picker's slider (faster → smarter) and sent with each request.
 *
 * Levels are per model, not per vendor — GLM-5.3 cannot turn thinking off
 * and takes low / high / max, GLM-5.2 can, GPT-5 takes minimal…high while
 * GPT-5.2 takes none…xhigh. The table below lists only what each vendor's
 * documentation states (sources in docs/settings-map.md); a model it does
 * not know offers no slider and nothing is sent. Leaving the slider untouched
 * also sends nothing, so the service's own default applies.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonBody = { [key: string]: Json };

/** The AI SDK's standard `reasoning` values (mapped by each provider package). */
export type StandardEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface ReasoningOption {
  id: string;
  label: string;
  hint: string;
  /** `reasoning_effort` value, when the model takes one. */
  effort?: StandardEffort;
  /** `thinking.type`, for services that switch thinking on and off this way. */
  thinking?: "enabled" | "disabled";
  /** `enable_thinking`, for Qwen 3 on OpenAI-compatible services. */
  enableThinking?: boolean;
}

export interface ReasoningProfile {
  /** Ordered from faster to smarter. */
  levels: readonly ReasoningOption[];
  /** The level the service uses when nothing is sent, when documented. */
  defaultId?: string;
  /** One line about the model's thinking, shown under the slider. */
  note: string;
}

const effort = (id: StandardEffort, label: string, hint: string, extra: Partial<ReasoningOption> = {}): ReasoningOption => ({ id, label, hint, effort: id, ...extra });
const NONE = effort("none", "关闭", "不思考，直接回答。");
const MINIMAL = effort("minimal", "最少", "几乎不思考，回复最快。");
const LOW = effort("low", "低", "少量思考，回复更快。");
const MEDIUM = effort("medium", "中", "适中的思考量。");
const HIGH = effort("high", "高", "更多思考，回复更慢、消耗更多 Token。");
const XHIGH = effort("xhigh", "超高", "大量思考，适合困难问题。");
const MAX = effort("max", "最高", "最深的推理，回复最慢、消耗最多 Token。");

const OFF: ReasoningOption = { id: "off", label: "关闭", hint: "关闭思考，直接回答。", thinking: "disabled" };
const AUTO: ReasoningOption = { id: "auto", label: "自动", hint: "开启思考，由模型决定是否需要思考。", thinking: "enabled" };

const RULES: readonly [RegExp, ReasoningProfile][] = [
  // 智谱 GLM (docs.bigmodel.cn 深度思考 / GLM-5.3)
  [/^glm-5\.3/, { levels: [effort("low", "低", "轻度推理，回复更快。"), effort("high", "高", "增强推理。"), effort("max", "最高", "深度推理。")], defaultId: "max",
    note: "GLM-5.3 系列始终思考，不能关闭。" }],
  [/^glm-5\.2/, { levels: [NONE, HIGH, MAX], defaultId: "max", note: "GLM-5.2 的低、中档按“高”处理，所以只列实际生效的档位。" }],
  [/^glm-(5\.1|5|5-turbo|5v-turbo|4\.6v?|4\.5)$/, { levels: [OFF, AUTO], defaultId: "auto", note: "这个模型没有思考强度，只能开关；开启时由模型决定是否思考。" }],
  // DeepSeek V4 (api-docs.deepseek.com thinking mode); effort needs thinking on.
  [/^deepseek-(v4|flash|pro)/, { levels: [OFF, effort("low", "低", "少量思考。", { thinking: "enabled" }), effort("high", "高", "默认的思考强度。", { thinking: "enabled" }), effort("max", "最高", "最深的推理。", { thinking: "enabled" })],
    defaultId: "high", note: "DeepSeek V4 的中档按“高”处理。" }],
  // OpenAI (platform reasoning guide); Pro models accept a single level and are left out.
  [/^gpt-5\.1-codex-max/, { levels: [LOW, MEDIUM, HIGH, XHIGH], note: "Codex 模型不能关闭推理。" }],
  [/^gpt-5\.1-codex/, { levels: [LOW, MEDIUM, HIGH], note: "Codex 模型不能关闭推理。" }],
  [/^gpt-5\.\d+-codex/, { levels: [LOW, MEDIUM, HIGH, XHIGH], note: "Codex 模型不能关闭推理。" }],
  [/^gpt-5\.1(-(?!pro)|$)/, { levels: [NONE, LOW, MEDIUM, HIGH], defaultId: "none", note: "GPT-5.1 默认不推理。" }],
  [/^gpt-5\.\d+(-(?!pro)|$)/, { levels: [NONE, LOW, MEDIUM, HIGH, XHIGH], note: "GPT-5.2 起支持超高档。" }],
  [/^gpt-5(-mini|-nano)?(-\d{4}-\d{2}-\d{2})?$/, { levels: [MINIMAL, LOW, MEDIUM, HIGH], defaultId: "medium", note: "GPT-5 不能完全关闭推理，最少档最快。" }],
  [/^o(1|3|4)(-mini)?(-\d{4}-\d{2}-\d{2})?$/, { levels: [LOW, MEDIUM, HIGH], defaultId: "medium", note: "o 系列推理模型始终推理。" }],
  // Anthropic: extended thinking is off unless requested.
  [/^claude-(opus|sonnet|haiku)-(4|5)|^claude-(3-7|4|5)/, { levels: [NONE, LOW, MEDIUM, HIGH], defaultId: "none", note: "Claude 默认不开启扩展思考。" }],
  [/^gemini-(2\.5|3)/, { levels: [LOW, MEDIUM, HIGH], note: "经 OpenAI 兼容接口以 reasoning_effort 设置。" }],
  [/^qwen3/, { levels: [{ id: "off", label: "关闭", hint: "关闭思考，直接回答。", enableThinking: false }, { id: "on", label: "开启", hint: "开启思考，回复更慢。", enableThinking: true }],
    note: "通义千问 3 只能开关思考。" }],
];

/** The thinking levels a model documents, or nothing for a model the table does not know. */
export function reasoningProfile(model: string | undefined): ReasoningProfile | undefined {
  const id = String(model ?? "").trim().toLowerCase().replace(/^.*\//, "");
  return id ? RULES.find(([pattern]) => pattern.test(id))?.[1] : undefined;
}

/** A level the model offers, else undefined (which sends nothing). */
export function reasoningOption(model: string | undefined, level: unknown): ReasoningOption | undefined {
  return typeof level === "string" ? reasoningProfile(model)?.levels.find((option) => option.id === level) : undefined;
}

export interface ReasoningCallOptions {
  /** The SDK's standard setting, for the Anthropic and built-in providers. */
  reasoning?: StandardEffort;
  /** Provider options for an OpenAI-compatible profile (camelCase keys are read by the SDK, the rest go into the body). */
  compatible?: JsonBody;
}

/** What one request sends for a level, by how the model is reached. */
export function reasoningCallOptions(option: ReasoningOption | undefined, transport: "compatible" | "sdk"): ReasoningCallOptions {
  if (!option) return {};
  if (transport === "sdk") {
    const reasoning = option.effort ?? (option.thinking === "disabled" || option.enableThinking === false ? "none" : undefined);
    return reasoning ? { reasoning } : {};
  }
  const body: JsonBody = {};
  if (option.effort) body.reasoningEffort = option.effort;
  if (option.thinking) body.thinking = { type: option.thinking };
  if (option.enableThinking !== undefined) body.enable_thinking = option.enableThinking;
  return { compatible: body };
}
