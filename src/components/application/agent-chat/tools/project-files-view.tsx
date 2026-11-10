import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { Key } from "react-aria-components";
import { ArrowLeftIcon, CodeIcon, CopyIcon, FileIcon, FolderIcon, LinkIcon, RefreshCwIcon } from "@/components/foundations/icons/app-icons";
import { TreeView, TreeViewItem } from "@/components/base/tree-view/tree-view";
import { Select, SelectItem } from "@/components/base/select/select";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/base/context-menu/context-menu";
import { projectFolderName } from "@/app/projects/project-folders";
import { formatBytes, type ProjectEntry, type ProjectFile, type ProjectListing } from "@/app/projects/project-workspace";
import { projectWorkspace } from "@/app/projects/project-workspace-client";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";
import { FileText } from "./file-text";
import { OpenInEditorButton, openInEditor } from "./open-in-editor-button";
import { useEditorPreferences } from "@/hooks/use-editor-preferences";
import { ToolPanelMessage } from "./tool-panel-frame";
import { toast } from "@/components/base/toast/toast";

type Folder = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; listing: ProjectListing };
type Preview = { path: string; state: { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; file: ProjectFile } };

const message = (error: unknown) => error instanceof Error ? error.message : "读取失败。";

/**
 * 文件: one selected project root at a time. Each root has an independent
 * on-demand tree, and the terminal and Git tools keep using the primary root.
 */
export function ProjectFilesView({ folders, onActions }: { folders: string[]; onActions: (actions: React.ReactNode) => void }) {
  const [selection, setSelection] = useState<string>();
  const root = selection && folders.includes(selection) ? selection : folders[0];
  if (!root) return null;
  return <>
    <div className="flex min-w-0 shrink-0 items-center gap-2 px-2 pb-2">
      {folders.length > 1
        ? <Select size="sm" aria-label="项目源文件夹" selectedKey={root} className="min-w-0 flex-1"
            triggerClassName="w-full" onSelectionChange={(key) => setSelection(key == null ? undefined : String(key))}>
            {folders.map((folder, index) => <SelectItem key={folder} id={folder} textValue={projectFolderName(folder)}>
              <span translate="no" title={folder} className="truncate">{projectFolderName(folder)}</span>
              {index === 0 && <span className="ms-auto shrink-0 text-caption-1-regular text-text-secondary">主要</span>}
            </SelectItem>)}
          </Select>
        : <p translate="no" title={root} className="min-w-0 flex-1 truncate text-body-2-medium text-text-secondary">{projectFolderName(root)}</p>}
      {isTauri() && <ToolbarIconButton icon={FolderIcon} label="在文件管理器打开源文件夹"
        onPress={() => { void openInEditor(root, "", "system").catch((error) => toast.error(message(error))); }} />}
    </div>
    <ProjectFileTree key={root} root={root} onActions={onActions} />
  </>;
}

function ProjectFileTree({ root, onActions }: { root: string; onActions: (actions: React.ReactNode) => void }) {
  const [folders, setFolders] = useState<Record<string, Folder>>({});
  const [open, setOpen] = useState<Set<string>>(() => new Set([""]));
  const [preview, setPreview] = useState<Preview>();
  const { external: editor } = useEditorPreferences();
  /** The row a right-click landed on; the menu acts on it. */
  const target = useRef<string | undefined>(undefined);

  const load = useCallback(async (dir: string) => {
    setFolders((current) => ({ ...current, [dir]: { kind: "loading" } }));
    try {
      const listing = await projectWorkspace.list(root, dir);
      setFolders((current) => ({ ...current, [dir]: { kind: "ready", listing } }));
    } catch (error) {
      setFolders((current) => ({ ...current, [dir]: { kind: "error", message: message(error) } }));
    }
  }, [root]);

  useEffect(() => { void load(""); }, [load]);

  const reload = useCallback(() => { for (const dir of open) void load(dir); }, [open, load]);
  useEffect(() => {
    onActions(<ToolbarIconButton icon={RefreshCwIcon} label="刷新文件" onPress={reload} />);
  }, [onActions, reload]);

  const show = async (path: string) => {
    setPreview({ path, state: { kind: "loading" } });
    try {
      const file = await projectWorkspace.read(root, path);
      setPreview((current) => current?.path === path ? { path, state: { kind: "ready", file } } : current);
    } catch (error) {
      setPreview((current) => current?.path === path ? { path, state: { kind: "error", message: message(error) } } : current);
    }
  };

  if (preview) return <FilePreview root={root} preview={preview} onBack={() => setPreview(undefined)} />;
  const top = folders[""];
  if (!top || top.kind === "loading") return <ToolPanelMessage icon={FolderIcon} title="正在读取文件夹…" />;
  if (top.kind === "error") return <ToolPanelMessage tone="error" title="无法读取项目文件夹" detail={top.message} />;
  if (top.listing.entries.length === 0) return <ToolPanelMessage title="文件夹是空的" />;

  const entries = new Map<string, ProjectEntry>();
  // A folder not read yet holds one placeholder row, so it shows a disclosure
  // arrow; expanding it reads the folder and the real rows replace it.
  const items = (dir: string): React.ReactNode => {
    const folder = folders[dir];
    if (!folder || folder.kind === "loading") return <TreeViewItem id={`${dir}\0loading`} label="读取中…" icon={null} isDisabled />;
    if (folder.kind === "error") return <TreeViewItem id={`${dir}\0error`} label={folder.message} icon={null} isDisabled />;
    return <>
      {folder.listing.entries.map((entry) => {
        entries.set(entry.path, entry);
        return <TreeViewItem key={entry.path} id={entry.path} label={entry.name}
          icon={entry.kind === "link" ? LinkIcon : undefined}
          trailingContent={entry.kind === "file" ? <span className="tabular-nums">{formatBytes(entry.size)}</span> : undefined}>
          {entry.kind === "dir" ? items(entry.path) : null}
        </TreeViewItem>;
      })}
      {folder.listing.truncated && <TreeViewItem id={`${dir}\0truncated`} label="只显示前 2000 项。" icon={null} isDisabled />}
    </>;
  };
  const tree = items("");
  const expand = (keys: Set<Key>) => {
    const next = new Set([...keys].map(String));
    for (const dir of next) if (!open.has(dir) && (!folders[dir] || folders[dir].kind === "error")) void load(dir);
    setOpen(next);
  };
  const absolute = (path: string) => `${root.replace(/\/+$/, "")}/${path}`;
  const act = (key: Key) => {
    const path = target.current;
    if (!path) return;
    if (key === "open") { if (entries.get(path)?.kind === "dir") expand(new Set([...open, path])); else void show(path); }
    else if (key === "editor") void openInEditor(root, path, editor).catch((error) => toast.error(message(error)));
    else if (key === "copy") void navigator.clipboard?.writeText(absolute(path));
    else if (key === "copy-relative") void navigator.clipboard?.writeText(path);
  };

  return <div className="min-h-0 flex-1 overflow-auto px-2 pb-3" onContextMenuCapture={(event) => {
    const row = (event.target as Element).closest?.("[role=row][data-key]");
    target.current = row?.getAttribute("data-key") ?? undefined;
  }}>
    <ContextMenuTrigger>
      <TreeView aria-label="项目文件" size="sm" selectionMode="none" className="rounded-none border-0 bg-transparent p-0"
        expandedKeys={open} onExpandedChange={expand}
        onAction={(key) => { const entry = entries.get(String(key)); if (entry && entry.kind !== "dir") void show(entry.path); }}>
        {tree}
      </TreeView>
      <ContextMenu aria-label="文件操作" onAction={act}>
        <ContextMenuItem id="open" icon={FileIcon}>打开</ContextMenuItem>
        {isTauri() && <ContextMenuItem id="editor" icon={CodeIcon}>在编辑器中打开</ContextMenuItem>}
        <ContextMenuSeparator />
        <ContextMenuItem id="copy" icon={CopyIcon}>复制路径</ContextMenuItem>
        <ContextMenuItem id="copy-relative" icon={CopyIcon}>复制相对路径</ContextMenuItem>
      </ContextMenu>
    </ContextMenuTrigger>
  </div>;
}

function FilePreview({ root, preview, onBack }: { root: string; preview: Preview; onBack: () => void }) {
  const { state } = preview;
  const { wrap } = useEditorPreferences();
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 items-center gap-2 px-2 pb-2">
      <ToolbarIconButton icon={ArrowLeftIcon} label="返回文件列表" onPress={onBack} />
      <span translate="no" title={preview.path} className="min-w-0 flex-1 truncate font-mono text-caption-1-regular text-text-secondary">{preview.path}</span>
      {state.kind === "ready" && <span className="shrink-0 text-caption-1-regular text-text-tertiary">{formatBytes(state.file.size)}</span>}
      <OpenInEditorButton root={root} path={preview.path} />
    </div>
    {state.kind === "loading" && <ToolPanelMessage icon={FileIcon} title="正在读取文件…" />}
    {state.kind === "error" && <ToolPanelMessage tone="error" icon={FileIcon} title="无法读取这个文件" detail={state.message} />}
    {state.kind === "ready" && (state.file.tooLarge
      ? <ToolPanelMessage icon={FileIcon} title="文件太大，不在这里预览" detail="只预览 512 KB 以内的文本文件。" />
      : state.file.binary || state.file.text === undefined
        ? <ToolPanelMessage icon={FileIcon} title="这是二进制文件" detail="只预览文本文件。" />
        : <FileText text={state.file.text} wrap={wrap} />)}
  </div>;
}
