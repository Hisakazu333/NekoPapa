import { useState } from "react";
import { addComposerFiles, buildComposerText, composerDraftBlockReason, createComposerDraft, type ComposerContext, type ComposerDraft, type ComposerMode } from "@/app/chat-composer-draft";
import { composerModelBlockReason, composerModels, type ComposerModelOption, type ComposerRuntimeModel } from "@/app/composer-model";
import { addPageElement, type PageElement } from "@/app/browser-pick";
import { chatModelProfile } from "@/app/chat-model-profile";
import { useConfiguration } from "./use-configuration";

interface DraftState { draft: ComposerDraft; selectedModel?: ComposerModelOption; error?: string }

/** Each mounted chat owns its drafts; switching a workbench thread keeps its own key. */
export function useChatComposer(scope: string, runtime: ComposerRuntimeModel, context: ComposerContext = "custom") {
  const { data } = useConfiguration();
  const [states, setStates] = useState<Record<string, DraftState>>({});
  // New drafts start in General → 新建对话 → 默认模式; drafts already open keep their mode.
  const defaultMode = data.groups.general.defaultMode as ComposerMode;
  const fresh = () => ({ draft: createComposerDraft(context, defaultMode) });
  const state = states[scope] ?? fresh();
  const update = (change: (previous: DraftState) => DraftState) => {
    setStates((all) => ({ ...all, [scope]: change(all[scope] ?? fresh()) }));
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
  const requestBody = { ...(profile ? { profile } : {}), ...(instructions ? { instructions } : {}) };
  const draftBlockReason = composerDraftBlockReason(state.draft);
  return {
    draft: state.draft,
    error: state.error,
    models,
    selected,
    selectedModelId: selected?.id,
    modelBlockReason,
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
