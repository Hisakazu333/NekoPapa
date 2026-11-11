import { useEffect, useState, type ReactNode } from "react";
import {
  AnnotateIcon, FileArchiveIcon, FileAudioIcon, FileCodeIcon, FileIcon, FileSpreadsheetIcon, FileTextIcon, FileVideoIcon,
  ImageIcon, PresentationIcon, XIcon,
} from "@/components/foundations/icons/app-icons";
import { composerArtifacts } from "@/app/chat/chat-composer-draft";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import { cx } from "@/utils/cx";

export function ComposerDraftSummary({ state, disabled }: { state: ChatComposerState; disabled?: boolean }) {
  const { draft } = state;
  return <>
    {draft.attachments.length > 0 && <ul aria-label="附件" className="flex gap-2 overflow-x-auto px-1 pt-1 pb-0.5 [scrollbar-width:none]">
      {draft.attachments.map((file) => <AttachmentTile key={file.id} file={file.file} name={file.name} path={file.path} size={file.size} disabled={disabled}
        onRemove={() => state.setDraft((previous) => ({ ...previous, attachments: previous.attachments.filter((item) => item.id !== file.id) }))} />)}
    </ul>}
    {(draft.pageElements.length > 0 || draft.goal || draft.planning || draft.artifact) && <div aria-label="聊天草稿选项" className="flex max-h-32 flex-wrap gap-2 overflow-y-auto px-1 pt-1">
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

const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|heic|bmp)$/i;
const KINDS: [RegExp, typeof FileIcon][] = [
  [/\.(docx?|pages|rtf|txt|md|pdf|odt)$/i, FileTextIcon],
  [/\.(xlsx?|numbers|csv|tsv|ods)$/i, FileSpreadsheetIcon],
  [/\.(pptx?|key|odp)$/i, PresentationIcon],
  [/\.(tsx?|jsx?|mjs|cjs|py|rs|go|java|kt|swift|c|cc|cpp|h|hpp|rb|php|cs|sh|json|ya?ml|toml|html|css|sql)$/i, FileCodeIcon],
  [/\.(mp4|mov|m4v|webm|mkv|avi)$/i, FileVideoIcon],
  [/\.(mp3|wav|m4a|flac|aac|ogg)$/i, FileAudioIcon],
  [/\.(zip|tar|gz|tgz|rar|7z)$/i, FileArchiveIcon],
];

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

const formatSize = (size: number) => {
  const kb = Math.max(1, Math.ceil(size / 1024));
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
};

/**
 * A picked file as a 56px tile (after BoardUI's Composer Attachments): an
 * image fills the tile with its own thumbnail; any other file shows its
 * type's icon with the name beneath, truncated to the tile. The remove
 * button sits in the corner — frosted over a thumbnail — and the full path
 * and size are in the tooltip. Files are read from memory; nothing uploads,
 * so no progress ring is drawn.
 */
function AttachmentTile({ file, name, path, size, onRemove, disabled }: { file: File; name: string; path: string; size: number; onRemove: () => void; disabled?: boolean }) {
  const image = IMAGE.test(name) || file.type.startsWith("image/");
  const preview = useImagePreview(file, image);
  const [failed, setFailed] = useState(false);
  const thumbnail = preview && !failed;
  const TypeIcon = image ? ImageIcon : KINDS.find(([pattern]) => pattern.test(name))?.[1] ?? FileIcon;
  return <li title={`${path} · ${formatSize(size)}`}
    className="group/tile relative size-14 shrink-0 overflow-hidden rounded-xl border border-separator-border bg-background-secondary-default motion-safe:animate-[bui-tile-in_220ms_ease-out]">
    {thumbnail
      ? <img src={preview} alt={name} className="size-full object-cover" onError={() => setFailed(true)} />
      : <div className="flex size-full flex-col items-center justify-center gap-1 px-1 text-foreground-icon-secondary">
        <TypeIcon className="size-6 shrink-0" aria-hidden />
        <span translate="no" className="w-full truncate text-center text-caption-2-regular text-text-tertiary">{name}</span>
      </div>}
    <button type="button" aria-label={`移除附件${name}`} disabled={disabled} onClick={onRemove}
      className={cx("absolute end-1 top-1 flex size-[18px] cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:opacity-50",
        thumbnail ? "bg-background-primary-default/80 text-text-primary shadow-xs backdrop-blur-sm hover:bg-background-primary-default" : "bg-background-tertiary-default text-text-secondary hover:text-text-primary")}>
      <XIcon className="size-3" aria-hidden />
    </button>
  </li>;
}
