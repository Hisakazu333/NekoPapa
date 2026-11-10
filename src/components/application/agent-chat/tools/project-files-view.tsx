import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon, ChevronRightIcon, FileIcon, FolderIcon, FolderOpenIcon, LinkIcon, RefreshCwIcon } from "@/components/foundations/icons/app-icons";
import { formatBytes, type ProjectEntry, type ProjectFile, type ProjectListing } from "@/app/project-workspace";
import { projectWorkspace } from "@/app/project-workspace-client";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { cx } from "@/utils/cx";
import { FileText } from "./file-text";
import { ToolPanelMessage } from "./tool-panel-frame";

type Folder = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; listing: ProjectListing };
type Preview = { path: string; state: { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; file: ProjectFile } };

const message = (error: unknown) => error instanceof Error ? error.message : "读取失败。";

/**
 * 文件: the project's primary folder as an expandable tree, read on demand
 * one folder at a time; choosing a file shows it read-only with line numbers.
 */
export function ProjectFilesView({ root, onActions }: { root: string; onActions: (actions: React.ReactNode) => void }) {
  const [folders, setFolders] = useState<Record<string, Folder>>({});
  const [open, setOpen] = useState<Set<string>>(() => new Set([""]));
  const [preview, setPreview] = useState<Preview>();

  const load = useCallback(async (dir: string) => {
    setFolders((current) => ({ ...current, [dir]: { kind: "loading" } }));
    try {
      const listing = await projectWorkspace.list(root, dir);
      setFolders((current) => ({ ...current, [dir]: { kind: "ready", listing } }));
    } catch (error) {
      setFolders((current) => ({ ...current, [dir]: { kind: "error", message: message(error) } }));
    }
  }, [root]);

  // A new project starts from its top folder.
  useEffect(() => { setFolders({}); setOpen(new Set([""])); setPreview(undefined); void load(""); }, [root, load]);

  const reload = useCallback(() => { for (const dir of open) void load(dir); }, [open, load]);
  useEffect(() => {
    onActions(<ToolbarIconButton icon={RefreshCwIcon} label="刷新文件" onPress={reload} />);
  }, [onActions, reload]);

  const toggle = (dir: string) => {
    const next = new Set(open);
    if (next.has(dir)) next.delete(dir);
    else { next.add(dir); if (!folders[dir] || folders[dir].kind === "error") void load(dir); }
    setOpen(next);
  };
  const show = async (path: string) => {
    setPreview({ path, state: { kind: "loading" } });
    try {
      const file = await projectWorkspace.read(root, path);
      setPreview((current) => current?.path === path ? { path, state: { kind: "ready", file } } : current);
    } catch (error) {
      setPreview((current) => current?.path === path ? { path, state: { kind: "error", message: message(error) } } : current);
    }
  };

  if (preview) return <FilePreview preview={preview} onBack={() => setPreview(undefined)} />;
  const top = folders[""];
  if (!top || top.kind === "loading") return <ToolPanelMessage icon={FolderIcon} title="正在读取文件夹…" />;
  if (top.kind === "error") return <ToolPanelMessage tone="error" title="无法读取项目文件夹" detail={top.message} />;
  if (top.listing.entries.length === 0) return <ToolPanelMessage title="文件夹是空的" />;

  const rows = (dir: string, depth: number): React.ReactNode => {
    const folder = folders[dir];
    if (!folder || folder.kind === "loading") return depth > 0 && <li className="flex items-center gap-2 py-1 text-caption-1-regular text-text-tertiary" style={{ paddingInlineStart: depth * 16 + 28 }}><SpinnerGlyph size="xs" />读取中</li>;
    if (folder.kind === "error") return <li role="alert" className="py-1 text-caption-1-regular text-text-error-primary" style={{ paddingInlineStart: depth * 16 + 28 }}>{folder.message}</li>;
    return <>
      {folder.listing.entries.map((entry) => <EntryRow key={entry.path} entry={entry} depth={depth} expanded={open.has(entry.path)}
        onToggle={() => toggle(entry.path)} onOpen={() => void show(entry.path)}>
        {entry.kind === "dir" && open.has(entry.path) && <ul>{rows(entry.path, depth + 1)}</ul>}
      </EntryRow>)}
      {folder.listing.truncated && <li className="py-1 text-caption-1-regular text-text-tertiary" style={{ paddingInlineStart: depth * 16 + 28 }}>只显示前 2000 项。</li>}
    </>;
  };
  return <ul aria-label="项目文件" className="min-h-0 flex-1 overflow-auto px-2 pb-3">{rows("", 0)}</ul>;
}

function EntryRow({ entry, depth, expanded, onToggle, onOpen, children }: {
  entry: ProjectEntry; depth: number; expanded: boolean; onToggle: () => void; onOpen: () => void; children?: React.ReactNode;
}) {
  const dir = entry.kind === "dir";
  const Icon = dir ? (expanded ? FolderOpenIcon : FolderIcon) : entry.kind === "link" ? LinkIcon : FileIcon;
  return <li>
    <button type="button" onClick={dir ? onToggle : onOpen} aria-expanded={dir ? expanded : undefined} title={entry.path}
      className="flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg pe-2 text-start outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      style={{ paddingInlineStart: depth * 16 + 4 }}>
      <ChevronRightIcon className={cx("size-4 shrink-0 text-foreground-icon-tertiary transition-transform", !dir && "invisible", expanded && "rotate-90")} aria-hidden />
      <Icon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
      <span translate="no" className="min-w-0 flex-1 truncate text-body-2-regular text-text-primary">{entry.name}</span>
      {entry.kind === "file" && <span className="shrink-0 text-caption-1-regular text-text-tertiary tabular-nums">{formatBytes(entry.size)}</span>}
    </button>
    {children}
  </li>;
}

function FilePreview({ preview, onBack }: { preview: Preview; onBack: () => void }) {
  const { state } = preview;
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 items-center gap-2 px-2 pb-2">
      <ToolbarIconButton icon={ArrowLeftIcon} label="返回文件列表" onPress={onBack} />
      <span translate="no" title={preview.path} className="min-w-0 flex-1 truncate font-mono text-caption-1-regular text-text-secondary">{preview.path}</span>
      {state.kind === "ready" && <span className="shrink-0 text-caption-1-regular text-text-tertiary">{formatBytes(state.file.size)}</span>}
    </div>
    {state.kind === "loading" && <ToolPanelMessage icon={FileIcon} title="正在读取文件…" />}
    {state.kind === "error" && <ToolPanelMessage tone="error" icon={FileIcon} title="无法读取这个文件" detail={state.message} />}
    {state.kind === "ready" && (state.file.tooLarge
      ? <ToolPanelMessage icon={FileIcon} title="文件太大，不在这里预览" detail="只预览 512 KB 以内的文本文件。" />
      : state.file.binary || state.file.text === undefined
        ? <ToolPanelMessage icon={FileIcon} title="这是二进制文件" detail="只预览文本文件。" />
        : <FileText text={state.file.text} />)}
  </div>;
}
