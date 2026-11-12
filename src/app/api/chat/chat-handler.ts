import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  safeValidateUIMessages,
  smoothStream,
  streamText,
  toUIMessageStream,
} from "ai";
import { readAgentWorkspace, type AgentWorkspace } from "../../agent/agent-request";
import { activeAgentTools, agentToolApproval, createAgentTools } from "../../agent/agent-tools";
import { AGENT_UNAVAILABLE_PROMPT, agentSystemPrompt } from "../../agent/agent-prompt";
import { resolveChatContact, contactSystemPrompt } from "./contact-prompt";
import { groupSystemPrompt, resolveGroupContext, type GroupContext } from "./group-context";
import { REPLY_FORMAT_PROMPT } from "./reply-format-prompt";
import type { ChatContactMetadata } from "../../../components/application/agent-chat/chat-contact";
import { OFFICIAL_COMPANION_UNAVAILABLE_REASON } from "../../contacts/official-companion-service";
import { chatReplyMetadata } from "../../usage/chat-usage";
import { createTraceRecorder } from "../../agent/trace-recorder";
import { readChatModelProfile } from "../../models/chat-model-profile";
import { reasoningCallOptions, reasoningOption } from "../../models/reasoning-level";
import { serviceVendor } from "../../models/model-vendors";
import { PROFILE_PROVIDER_NAME, profileProvider, resolveProvider, type Provider } from "./providers";
import type { ChatRuntime } from "./runtime";

/** Bumped when the contract below changes in a way templates can depend on (2: project tools). */
const RUNTIME_CONTRACT = 2;
/** Model calls in one reply before it stops and reports, so a tool loop cannot run away. */
const MAX_AGENT_STEPS = 30;
const INSTRUCTIONS_LIMIT = 12000;
/** Built-in providers that reach a vendor's own API, by the reasoning table's vendor ids. */
const BUILT_IN_VENDORS: Partial<Record<string, string>> = { openai: "openai", anthropic: "anthropic", google: "gemini", deepseek: "deepseek" };

/** Keep the assistant's identity and capability claims aligned with this chat. */
function systemPrompt(provider: Provider, contact?: ChatContactMetadata, group?: GroupContext, instructions?: string, agent?: string) {
  return [
    // 设置 → 个性化: the user's own standing instructions, for every chat.
    instructions ? `The user's standing instructions for you:\n${instructions}` : "",
    contactSystemPrompt(contact),
    groupSystemPrompt(group, contact),
    `This conversation is answered by ${provider.label} using ${provider.modelId}.`,
    REPLY_FORMAT_PROMPT,
    agent ?? "",
  ].filter(Boolean).join("\n");
}

/**
 * The chat endpoint's GET (config probe) and POST (one streamed reply) for a
 * runtime: the dev server's Node process (route.ts), or the desktop app,
 * where the same handlers run in the window and the host makes the requests.
 */
export function createChatHandlers(runtime: ChatRuntime) {
  /**
   * Config probe. The UI calls this on mount so a deployment with no key yet can
   * render setup instructions instead of letting someone type a message and hit
   * an error — a fresh deploy's first impression should explain itself.
   */
  async function GET() {
    const { provider, reason } = resolveProvider(runtime);
    return Response.json({
      configured: provider !== null,
      provider: provider?.id ?? null,
      providerLabel: provider?.label ?? null,
      model: provider?.modelId ?? null,
      reason: reason ?? null,
      officialCompanions: { configured: false, reason: OFFICIAL_COMPANION_UNAVAILABLE_REASON },
      contract: RUNTIME_CONTRACT,
    });
  }

  async function POST(req: Request) {
    const badBody = Response.json(
      { error: "invalid_body", message: "Expected JSON with a messages array." },
      { status: 400 },
    );

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badBody;
    }

    const submitted = (body as { messages?: unknown } | null)?.messages;
    if (!Array.isArray(submitted)) return badBody;
    const submittedContact = (body as { contact?: unknown }).contact;
    const contact = submittedContact === undefined ? undefined : resolveChatContact(submittedContact);
    if (submittedContact !== undefined && !contact) {
      return Response.json({ error: "invalid_contact", message: "Expected a valid contact identity." }, { status: 400 });
    }
    // The official persona is owned by the server; conversation history cannot
    // append another system instruction that rewrites its fixed character.
    if (contact?.kind === "official" && submitted.some((message) =>
      message !== null && typeof message === "object" && message.role === "system")) {
      return Response.json({ error: "invalid_messages", message: "Client system messages cannot override an official companion's fixed persona." }, { status: 400 });
    }
    const submittedGroup = (body as { groupContext?: unknown }).groupContext;
    const group = submittedGroup === undefined ? undefined : resolveGroupContext(submittedGroup, contact);
    if (submittedGroup !== undefined && !group) return Response.json({ error: "invalid_group", message: "Expected 2–5 distinct group members including the selected speaker." }, { status: 400 });

    // A generic model key is not an official character service. The Java backend
    // must resolve the authoritative persona; never substitute local profile text.
    if (contact?.kind === "official") {
      return Response.json({ error: "official_companion_unavailable", message: OFFICIAL_COMPANION_UNAVAILABLE_REASON }, { status: 503 });
    }

    // A saved 设置 → 模型与 API profile answers when the composer chose one;
    // otherwise the environment's provider does.
    const submittedProfile = (body as { profile?: unknown }).profile;
    const profile = submittedProfile === undefined ? undefined : readChatModelProfile(submittedProfile);
    if (submittedProfile !== undefined && !profile) {
      return Response.json({ error: "invalid_profile", message: "Expected a valid model profile." }, { status: 400 });
    }
    const { provider, reason } = profile ? profileProvider(profile, runtime) : resolveProvider(runtime);
    if (!provider) return Response.json({ error: "missing_api_key", message: reason }, { status: 503 });
    const submittedInstructions = (body as { instructions?: unknown }).instructions;
    const instructions = typeof submittedInstructions === "string" ? submittedInstructions.trim().slice(0, INSTRUCTIONS_LIMIT) : undefined;
    // 推理档位 from the model picker: a level the answering model documents;
    // absent means nothing is sent and the service's default applies.
    const submittedReasoning = (body as { reasoning?: unknown }).reasoning;
    // The level table belongs to the vendor actually answering: a saved
    // profile's endpoint host, or the built-in provider the environment named.
    const reasoningVendor = profile
      ? (profile.provider === "anthropic") === (serviceVendor(profile.endpoint) === "anthropic") ? serviceVendor(profile.endpoint) : undefined
      : runtime.env("AI_BASE_URL")?.trim() ? undefined : BUILT_IN_VENDORS[provider.id];
    const reasoningLevel = submittedReasoning === undefined ? undefined : reasoningOption(provider.modelId, reasoningVendor, submittedReasoning);
    if (submittedReasoning !== undefined && !reasoningLevel) {
      return Response.json({ error: "invalid_reasoning", message: `${provider.modelId} does not offer that reasoning level on this service.` }, { status: 400 });
    }
    // Saved OpenAI-compatible profiles take the model's own fields; the
    // Anthropic and built-in providers map the SDK's standard setting.
    const reasoning = reasoningCallOptions(reasoningLevel, profile && profile.provider !== "anthropic" ? "compatible" : "sdk");

    // The project this workbench chat works in. Tools exist only where the
    // runtime can reach the computer (the desktop app) and never for contacts.
    const submittedWorkspace = (body as { workspace?: unknown }).workspace;
    const workspace: AgentWorkspace | undefined = submittedWorkspace === undefined ? undefined : readAgentWorkspace(submittedWorkspace);
    if (submittedWorkspace !== undefined && (!workspace || contact)) {
      return Response.json({ error: "invalid_workspace", message: "Expected a project folder, its name and a permission mode, outside contact chats." }, { status: 400 });
    }
    const agent = workspace && runtime.agent ? {
      tools: createAgentTools(runtime.agent, workspace.root),
      activeTools: activeAgentTools(workspace.permission),
      toolApproval: agentToolApproval(workspace.permission),
      stopWhen: isStepCount(MAX_AGENT_STEPS),
    } : undefined;
    const agentPrompt = workspace ? runtime.agent ? agentSystemPrompt(workspace.name, workspace.permission) : AGENT_UNAVAILABLE_PROMPT : undefined;

    // Validate before converting. `convertToModelMessages` throws on a message
    // missing `parts`, on a null entry, and on an unknown role — and it throws
    // outside any stream, so an unvalidated body would escape as a bare 500
    // instead of the error response this route promises its callers.
    const validated = await safeValidateUIMessages({ messages: submitted });
    if (!validated.success) {
      return Response.json(
        { error: "invalid_messages", message: validated.error.message },
        { status: 400 },
      );
    }

    const result = streamText({
      model: provider.model,
      system: systemPrompt(provider, contact, group, instructions, agentPrompt),
      ...agent,
      ...(reasoning.reasoning ? { reasoning: reasoning.reasoning } : {}),
      ...(reasoning.compatible ? { providerOptions: { [PROFILE_PROVIDER_NAME]: reasoning.compatible } } : {}),
      // Earlier replies' reasoning stays on screen but is not sent back:
      // providers such as DeepSeek reject it in the input.
      messages: await convertToModelMessages(validated.data.map((message) => ({ ...message, parts: message.parts.filter((part) => part.type !== "reasoning") }))),
      // Providers emit text in uneven bursts, and a burst of twenty words lands
      // as one repaint — which is what makes streamed text look like it stutters.
      // Releasing whole words on a steady tick turns that into an even flow, and
      // it also means the UI never sees a half-typed word.
      experimental_transform: smoothStream({ delayInMs: 18, chunking: "word" }),
      // Without this the provider keeps generating (and billing) after the
      // reader presses Stop, since aborting the fetch only ends the client side.
      abortSignal: req.signal,
    });

    const trace = createTraceRecorder();
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        // Reasoning models' thinking shows folded above the answer.
        sendReasoning: true,
        // Token counts the provider reported for this reply, saved with the
        // chat history so the profile page can sum real usage; and each
        // step's and tool call's timing, for the 轨迹 view.
        messageMetadata: ({ part }) => part.type === "finish"
          ? chatReplyMetadata(part.totalUsage, { model: provider.modelId, provider: provider.label, contextWindow: profile?.contextWindow })
          : trace(part),
      }),
    });
  }

  return { GET, POST };
}
