import { useState } from "react";
import { addComposerFiles, buildComposerText, composerDraftBlockReason, createComposerDraft, type ComposerContext, type ComposerDraft } from "@/app/chat-composer-draft";
import { composerModelBlockReason, composerModels, type ComposerRuntimeModel } from "@/app/composer-model";
import { useConfiguration } from "./use-configuration";

interface DraftState { draft: ComposerDraft; selectedModel?: string; error?: string }

/** Each mounted chat owns its drafts; switching a workbench thread keeps its own key. */
export function useChatComposer(scope: string, runtime: ComposerRuntimeModel, context: ComposerContext = "custom") {
  const { data } = useConfiguration();
  const [states, setStates] = useState<Record<string, DraftState>>({});
  const state = states[scope] ?? { draft: createComposerDraft(context) };
  const update = (change: (previous: DraftState) => DraftState) => {
    setStates((all) => ({ ...all, [scope]: change(all[scope] ?? { draft: createComposerDraft(context) }) }));
  };
  const models = composerModels(data.collections.models, runtime);
  const selected = models.find((option) => option.id === (state.selectedModel ?? "runtime"));
  const modelBlockReason = composerModelBlockReason(state.selectedModel, models);
  const draftBlockReason = composerDraftBlockReason(state.draft);
  return {
    draft: state.draft,
    error: state.error,
    models,
    selected,
    selectedModelId: state.selectedModel ?? (selected ? "runtime" : undefined),
    modelBlockReason,
    draftBlockReason,
    blockReason: draftBlockReason ?? modelBlockReason,
    setDraft: (change: (draft: ComposerDraft) => ComposerDraft) => update((previous) => ({ ...previous, draft: change(previous.draft) })),
    selectModel: (selectedModel: string) => update((previous) => ({ ...previous, selectedModel })),
    addFiles: (files: File[]) => update((previous) => {
      const result = addComposerFiles(previous.draft.attachments, files);
      return { ...previous, draft: { ...previous.draft, attachments: result.attachments }, error: result.errors.join(" ") || undefined };
    }),
    clearError: () => update((previous) => ({ ...previous, error: undefined })),
    prepareText: (text: string) => buildComposerText(text, state.draft),
  };
}

export type ChatComposerState = ReturnType<typeof useChatComposer>;
