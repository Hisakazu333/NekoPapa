import { useState } from "react";
import { addComposerFiles, buildComposerText, composerDraftBlockReason, composerModesForContext, createComposerDraft, type ComposerContext, type ComposerDraft } from "@/app/chat/chat-composer-draft";
import { composerModelBlockReason, composerModels, type ComposerModelOption, type ComposerRuntimeModel } from "@/app/models/composer-model";
import { addPageElement, type PageElement } from "@/app/browser/browser-pick";
import { chatModelProfile } from "@/app/models/chat-model-profile";
import { reasoningOption, reasoningProfile } from "@/app/models/reasoning-level";
import { useConfiguration } from "./use-configuration";

interface DraftState { draft: ComposerDraft; selectedModel?: ComposerModelOption; reasoning?: string; error?: string }

/** Each mounted chat owns its drafts; switching a workbench thread keeps its own key. */
export function useChatComposer(scope: string, runtime: ComposerRuntimeModel, context: ComposerContext = "custom") {
  const { data } = useConfiguration();
  const [states, setStates] = useState<Record<string, DraftState>>({});
  // New drafts take 设置 → 权限规则 → 权限模式; drafts already open keep their own choice.
  const fresh = () => ({ draft: createComposerDraft(context, data.groups.permissions.mode) });
  // The home composer keeps one draft while a contact is picked and cleared; a
  // mode the current context does not offer (study after leaving a contact)
  // reads as that context's first mode, so the workbench is always 自动.
  const modes = composerModesForContext(context);
  const fit = (previous: DraftState): DraftState => modes.some((mode) => mode.id === previous.draft.mode)
    ? previous : { ...previous, draft: { ...previous.draft, mode: modes[0].id } };
  const state = fit(states[scope] ?? fresh());
  const update = (change: (previous: DraftState) => DraftState) => {
    setStates((all) => ({ ...all, [scope]: change(fit(all[scope] ?? fresh())) }));
  };
  const models = composerModels(data.collections.models, runtime);
  // Without a runtime provider, the first usable saved profile answers until another is picked.
  const fallback = models.find((option) => option.runtime)?.id
    ?? models.find((option) => !option.runtime && !composerModelBlockReason(option.id, models, data.collections.models))?.id;
  const previous = state.selectedModel;
  const selected = previous?.connectionId
    ? models.find((option) => option.connectionId === previous.connectionId && option.model === previous.model)
    : models.find((option) => option.id === (previous?.id ?? fallback));
  const modelBlockReason = previous?.connectionId && !selected
    ? "所选模型配置已移除，请重新选择。"
    : composerModelBlockReason(selected?.id, models, data.collections.models);
  // What every send adds to the request: the saved profile the picker chose
  // (else the runtime's own provider answers) and 设置 → 个性化's instructions.
  const record = selected && !selected.runtime ? data.collections.models.find((entry) => entry.id === selected.connectionId) : undefined;
  const profile = record && selected ? chatModelProfile(record, selected.model).profile : undefined;
  const instructions = String(data.groups.personalization?.instructions ?? "").trim();
  // 推理档位 stays with this chat; a level the chosen model does not offer on
  // its service (judged by the endpoint's host) is not sent.
  const reasoning = reasoningOption(selected?.model, selected?.vendor, state.reasoning);
  const requestBody = { ...(profile ? { profile } : {}), ...(instructions ? { instructions } : {}),
    ...(reasoning ? { reasoning: reasoning.id } : {}) };
  const draftBlockReason = composerDraftBlockReason(state.draft);
  return {
    draft: state.draft,
    error: state.error,
    models,
    selected,
    selectedModelId: selected?.id,
    modelBlockReason,
    /** The level chosen for the selected model; undefined sends nothing. */
    reasoning,
    reasoningProfile: reasoningProfile(selected?.model, selected?.vendor),
    /** Sets the level, or clears it back to the service's default. */
    setReasoning: (level: string | undefined) => update((previous) => ({ ...previous, reasoning: level })),
    draftBlockReason,
    blockReason: draftBlockReason ?? modelBlockReason,
    /** A saved profile answers, so the runtime's own key is not needed. */
    usesProfile: Boolean(profile),
    requestBody,
    setDraft: (change: (draft: ComposerDraft) => ComposerDraft) => update((previous) => ({ ...previous, draft: change(previous.draft) })),
    selectModel: (id: string) => {
      const option = models.find((model) => model.id === id);
      if (option) update((previous) => ({ ...previous, selectedModel: option }));
    },
    addFiles: (files: File[]) => update((previous) => {
      const result = addComposerFiles(previous.draft.attachments, files);
      return { ...previous, draft: { ...previous.draft, attachments: result.attachments }, error: result.errors.join(" ") || undefined };
    }),
    /** Attaches an element picked in the built-in browser. */
    addPageElement: (element: Omit<PageElement, "id">) => update((previous) => {
      const result = addPageElement(previous.draft.pageElements, element, crypto.randomUUID());
      return { ...previous, draft: { ...previous.draft, pageElements: result.elements }, error: result.error };
    }),
    clearError: () => update((previous) => ({ ...previous, error: undefined })),
    prepareText: (text: string) => buildComposerText(text, state.draft),
  };
}

export type ChatComposerState = ReturnType<typeof useChatComposer>;
