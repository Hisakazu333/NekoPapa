import { useEffect, useState, type ReactNode } from "react";
import { AnnotateIcon, FileIcon, ImageIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { composerArtifacts } from "@/app/chat-composer-draft";
import type { ChatComposerState } from "@/hooks/use-chat-composer";

export function ComposerDraftSummary({ state, disabled }: { state: ChatComposerState; disabled?: boolean }) {
  const { draft } = state;
  return <>
    {(draft.attachments.length > 0 || draft.pageElements.length > 0 || draft.goal || draft.planning || draft.artifact) && <div aria-label="聊天草稿选项" className="flex max-h-32 flex-wrap gap-2 overflow-y-auto px-1 pt-1">
      {draft.attachments.map((file) => <FileCard key={file.id} file={file.file} name={file.name} path={file.path} size={file.size} disabled={disabled}
        onRemove={() => state.setDraft((previous) => ({ ...previous, attachments: previous.attachments.filter((item) => item.id !== file.id) }))} />)}
      {draft.pageElements.map((element) => <Chip key={element.id} label={`移除网页元素${element.selector || element.tag}`} disabled={disabled} onRemove={() => state.setDraft((previous) => ({ ...previous, pageElements: previous.pageElements.filter((item) => item.id !== element.id) }))}>
        <AnnotateIcon className="size-3.5 shrink-0" aria-hidden />
        <span title={`${element.comment ? `${element.comment}\n` : ""}${element.url}\n${element.selector}`} className="truncate">
          {element.comment ? <>批注：{element.comment}<span className="text-text-tertiary"> · &lt;{element.tag}&gt;</span></> : <>网页元素 &lt;{element.tag}&gt; {element.selector}</>}
          {Object.keys(element.changes ?? {}).length > 0 && <span className="text-text-tertiary"> · 改动 {Object.keys(element.changes).length} 项样式</span>}
        </span>
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
    {children}<button type="button" aria-label={label} disabled={disabled} className="shrink-0 cursor-pointer rounded-full p-0.5 outline-none hover:bg-background-tertiary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:opacity-50" onClick={onRemove}><XIcon className="size-3" aria-hidden /></button>
  </span>;
}

const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|heic)$/i;

/** Data URLs also work with the desktop window's image CSP. */
function useImagePreview(file: File, image: boolean) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!image) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setUrl(reader.result);
    };
    reader.readAsDataURL(file);
    return () => {
      reader.onload = null;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [file, image]);
  return url;
}

/**
 * A selected file as a small card (after BoardUI's Composer Attachments):
 * an image shows its own thumbnail, other files a type icon; then the name,
 * extension and size. The preview is read from the picked file in memory.
 */
function FileCard({ file, name, path, size, onRemove, disabled }: { file: File; name: string; path: string; size: number; onRemove: () => void; disabled?: boolean }) {
  const image = IMAGE.test(name) || file.type.startsWith("image/");
  const preview = useImagePreview(file, image);
  const [failed, setFailed] = useState(false);
  const TypeIcon = image ? ImageIcon : FileIcon;
  const extension = /\.([^.]+)$/.exec(name)?.[1]?.toUpperCase();
  const kb = Math.max(1, Math.ceil(size / 1024));
  return <span title={path} className="relative flex w-52 max-w-full items-center gap-2 rounded-xl border border-separator-border bg-background-secondary-default py-1.5 ps-1.5 pe-7">
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background-tertiary-default text-foreground-icon-secondary">
      {preview && !failed ? <img src={preview} alt="" className="size-full object-cover" onError={() => setFailed(true)} /> : <TypeIcon className="size-4" aria-hidden />}
    </span>
    <span className="flex min-w-0 flex-col">
      <span translate="no" className="truncate text-caption-1-medium text-text-primary">{name}</span>
      <span className="truncate text-caption-1-regular text-text-tertiary">{extension ? `${extension} · ` : ""}{kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`}</span>
    </span>
    <button type="button" aria-label={`移除附件${name}`} disabled={disabled} onClick={onRemove}
      className="absolute end-1.5 top-1.5 cursor-pointer rounded-full p-0.5 text-text-tertiary outline-none hover:bg-background-tertiary-default hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:opacity-50"><XIcon className="size-3" aria-hidden /></button>
  </span>;
}
