import type { ReactNode } from "react";
import { RiCloseLine, RiCursorLine } from "@remixicon/react";
import { composerArtifacts } from "@/app/chat-composer-draft";
import type { ChatComposerState } from "@/hooks/use-chat-composer";

export function ComposerDraftSummary({ state, disabled }: { state: ChatComposerState; disabled?: boolean }) {
  const { draft } = state;
  return <>
    {(draft.attachments.length > 0 || draft.pageElements.length > 0 || draft.goal || draft.planning || draft.artifact) && <div aria-label="聊天草稿选项" className="flex max-h-32 flex-wrap gap-2 overflow-y-auto px-1 pt-1">
      {draft.attachments.map((file) => <Chip key={file.id} label={`移除附件${file.name}`} disabled={disabled} onRemove={() => state.setDraft((previous) => ({ ...previous, attachments: previous.attachments.filter((item) => item.id !== file.id) }))}>
        <span title={file.path} className="truncate">{file.path}</span><span className="shrink-0 text-text-tertiary">{Math.max(1, Math.ceil(file.size / 1024))} KB</span>
      </Chip>)}
      {draft.pageElements.map((element) => <Chip key={element.id} label={`移除网页元素${element.selector || element.tag}`} disabled={disabled} onRemove={() => state.setDraft((previous) => ({ ...previous, pageElements: previous.pageElements.filter((item) => item.id !== element.id) }))}>
        <RiCursorLine className="size-3.5 shrink-0" aria-hidden />
        <span title={`${element.url}\n${element.selector}`} className="truncate">网页元素 &lt;{element.tag}&gt; {element.selector}</span>
        <span className="shrink-0 text-text-tertiary">{element.size.width}×{element.size.height}</span>
      </Chip>)}
      {draft.goal && <Chip label="清除聊天目标" disabled={disabled} onRemove={() => state.setDraft((previous) => ({ ...previous, goal: "" }))}><span title={draft.goal} className="truncate">目标：{draft.goal}</span></Chip>}
      {draft.planning && <Chip label="关闭计划模式" disabled={disabled} onRemove={() => state.setDraft((previous) => ({ ...previous, planning: false }))}>计划模式</Chip>}
      {draft.artifact && <Chip label="清除输出形式" disabled={disabled} onRemove={() => state.setDraft((previous) => ({ ...previous, artifact: null }))}>{composerArtifacts.find((item) => item.id === draft.artifact)?.label}<span className="text-text-tertiary">待接入</span></Chip>}
    </div>}
    {state.error && <p role="alert" className="px-1 text-caption-1-regular text-text-error-primary">{state.error} <button type="button" className="cursor-pointer underline" onClick={state.clearError}>关闭提示</button></p>}
  </>;
}

function Chip({ children, label, onRemove, disabled }: { children: ReactNode; label: string; onRemove: () => void; disabled?: boolean }) {
  return <span className="flex max-w-full items-center gap-2 rounded-xl bg-background-secondary-default px-2 py-1 text-caption-1-regular text-text-secondary">
    {children}<button type="button" aria-label={label} disabled={disabled} className="shrink-0 cursor-pointer rounded-full p-0.5 outline-none hover:bg-background-tertiary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:opacity-50" onClick={onRemove}><RiCloseLine className="size-3" aria-hidden /></button>
  </span>;
}
