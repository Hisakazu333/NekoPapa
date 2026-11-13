import type { DiffLine } from "../projects/project-workspace";
import type { Replacement } from "./agent-host";

/**
 * What an edit the Agent asks to make looks like, before it runs: shown in
 * the approval card. The real diff (with line numbers in the file) comes
 * back from the host once the change is applied.
 */

const PREVIEW_LINES = 200;
const lines = (text: string) => text === "" ? [] : text.replace(/\n$/, "").split("\n");

export function editPreview(oldText: string, newText: string): DiffLine[] {
  return [
    ...lines(oldText).map((text): DiffLine => ({ kind: "del", text })),
    ...lines(newText).map((text): DiffLine => ({ kind: "add", text })),
  ].slice(0, PREVIEW_LINES);
}

/** Several replacements in one edit: each under its own "第 n 处" marker. */
export function editsPreview(edits: readonly { oldText: string; newText: string; replaceAll?: boolean }[]): DiffLine[] {
  if (edits.length === 1 && !edits[0].replaceAll) return editPreview(edits[0].oldText, edits[0].newText);
  return edits.flatMap((edit, index): DiffLine[] => [
    { kind: "hunk", text: `第 ${index + 1} 处${edit.replaceAll ? "（全部出现处）" : ""}` },
    ...editPreview(edit.oldText, edit.newText),
  ]).slice(0, PREVIEW_LINES);
}

export function writePreview(content: string): DiffLine[] {
  return lines(content).slice(0, PREVIEW_LINES).map((text, index): DiffLine => ({ kind: "add", text, new: index + 1 }));
}

export const lineCount = (text: string) => lines(text).length;

/** An edit's replacements; a call saved before edits existed has one at the top level. */
export function readEdits(input: unknown): Replacement[] {
  const value = (input ?? {}) as { edits?: unknown; oldText?: unknown; newText?: unknown };
  const list = Array.isArray(value.edits) ? value.edits : [value];
  return list.flatMap((item) => {
    const edit = (item ?? {}) as Record<string, unknown>;
    return typeof edit.oldText === "string" && typeof edit.newText === "string"
      ? [{ oldText: edit.oldText, newText: edit.newText, replaceAll: edit.replaceAll === true }] : [];
  });
}
