import { useEffect, useId, useMemo, useState, type KeyboardEvent, type RefObject } from "react";
import { projectWorkspace } from "@/app/projects/project-workspace-client";
import { insertMention, mentionQuery, rankMentions } from "@/app/projects/file-mention";

const FRESH_MS = 30_000;
const indexes = new Map<string, { at: number; paths: Promise<string[]> }>();

/** A project's file list, read again when older than 30 seconds (files come and go while the Agent works). */
function projectFiles(root: string): Promise<string[]> {
  const cached = indexes.get(root);
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.paths;
  const paths = projectWorkspace.files(root).then((index) => index.paths);
  indexes.set(root, { at: Date.now(), paths });
  paths.catch(() => indexes.delete(root));
  return paths;
}

type Files = { root: string; paths?: string[]; error?: string };

/**
 * The composer's @ menu: typing @ (at the start or after a space) in a chat
 * with a project lists its files matching what follows; ↑↓ choose, Enter or
 * Tab inserts @path, Esc closes. Files come from the project's file index
 * (the desktop host, or the dev server in the browser preview).
 */
export function useFileMention(input: RefObject<HTMLTextAreaElement | null>, value: string, onChange: (value: string) => void, root?: string) {
  const [caret, setCaret] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [picked, setPicked] = useState(0);
  const [files, setFiles] = useState<Files>();
  const listId = useId();
  const query = root && caret !== null && caret <= value.length ? mentionQuery(value, caret) : undefined;
  const key = query ? `${query.start}:${value}` : null;
  const open = Boolean(query) && dismissed !== key;

  useEffect(() => {
    if (!open || !root) return;
    let live = true;
    projectFiles(root).then((paths) => { if (live) setFiles({ root, paths }); },
      (error: unknown) => { if (live) setFiles({ root, error: error instanceof Error ? error.message : "无法读取项目文件。" }); });
    return () => { live = false; };
  }, [open, root]);

  const ready = files?.root === root ? files : undefined;
  const needle = query?.query;
  const results = useMemo(() => open && needle !== undefined && ready?.paths ? rankMentions(ready.paths, needle) : [], [open, needle, ready]);
  const active = Math.min(picked, Math.max(0, results.length - 1));

  const pick = (path: string) => {
    if (!query || caret === null) return;
    const next = insertMention(value, query, caret, path);
    onChange(next.text);
    setCaret(next.caret);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(next.caret, next.caret); });
  };

  /** Keys the menu takes while open; true when the key was used. */
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!open || event.nativeEvent.isComposing) return false;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDismissed(key); return true; }
    if (results.length === 0) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setPicked((active + (event.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); pick(results[active]); return true; }
    return false;
  };

  /** Follows the caret: called on change, click and selection. */
  const track = () => { setCaret(input.current?.selectionStart ?? null); setPicked(0); };

  return {
    open, results, active, pick, onKeyDown, track, listId,
    loading: open && !ready, error: ready?.error,
    optionId: (index: number) => `${listId}-${index}`,
  };
}

export type FileMention = ReturnType<typeof useFileMention>;
