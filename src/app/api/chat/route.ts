
/**
 * The chat runtime every BoardUI agent template talks to.
 *
 * This file is the contract the starter's chat screen installs against, and
 * the one any later live chat screen should share: UI ships separately and
 * assumes exactly three things — a POST endpoint at `/api/chat`, an AI SDK
 * UI-message stream coming back, and the env vars below. Nothing else. Keep
 * that contract narrow; anything a screen needs beyond it becomes a reason
 * for it to not be portable.
 *
 * The CLI skips files that already exist, so installing anything else that
 * ships this file into a project that already has it keeps the customised
 * version rather than clobbering it. That is the desired behaviour, with one
 * consequence worth knowing: if this file gains a capability later (tool
 * calls, say) an older copy will NOT be replaced, and a newer template will
 * run against a stale backend. `RUNTIME_CONTRACT` is the version marker for
 * detecting that.
 *
 * Bring your own key. The simplest form is one variable, and the provider is
 * read off the key's own prefix:
 *
 *   AI_API_KEY=sk-ant-...   Anthropic        AI_API_KEY=gsk_...   Groq
 *   AI_API_KEY=sk-or-...    OpenRouter       AI_API_KEY=xai-...   xAI
 *   AI_API_KEY=sk-...       OpenAI           AI_API_KEY=vck_...   Vercel AI Gateway
 *   AI_API_KEY=AIza...      Google Gemini
 *
 * That is what lets the Vercel deploy button ask for a single value instead
 * of a form of nine optional fields. Every provider's conventional variable
 * (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, ...) is
 * honoured too and wins over AI_API_KEY, for anyone who already has one set.
 *
 * For keys with no recognisable shape (Mistral, DeepSeek) name the provider:
 *
 *   AI_PROVIDER=mistral   with AI_API_KEY or MISTRAL_API_KEY
 *
 * And any OpenAI-compatible server works by URL — Ollama, LM Studio, vLLM,
 * Together, Fireworks — with CHAT_MODEL naming the model, since there is no
 * sensible default for an arbitrary endpoint:
 *
 *   AI_BASE_URL=http://localhost:11434/v1  CHAT_MODEL=llama3.2
 *
 * CHAT_MODEL overrides the default model for any provider. Ids are provider
 * specific: OpenRouter and the Gateway namespace them ("openai/gpt-5-nano"),
 * the rest do not ("gpt-5.4-mini").
 *
 * SECURITY: the key is read server-side only and never leaves this file. Do
 * not move it to a NEXT_PUBLIC_ variable — that ships it to the browser, where
 * any visitor can read it out of the bundle and spend against it.
 *
 * COST: requests bill to whoever owns the key. Before putting a deployment
 * with a live key in front of the public, put a rate limit in front of this
 * route; a chat endpoint open to the internet is an open invitation to spend
 * someone else's money.
 */

import { createChatHandlers } from "./chat-handler";
import type { ChatRuntime } from "./runtime";
import { testModelProfile } from "./model-test";

/** Streaming replies outlive the default budget on longer answers. */
export const maxDuration = 30;

/** The dev and preview server: keys come from this process's environment. */
const nodeRuntime: ChatRuntime = {
  env: (name) => process.env[name],
  credential: (name) => process.env[name]?.trim() || undefined,
};

export const { GET, POST } = createChatHandlers(nodeRuntime);

/** 设置 → 模型与 API → 测试连接, at POST /api/model-test. */
export const TEST = (request: Request) => testModelProfile(request, nodeRuntime);
