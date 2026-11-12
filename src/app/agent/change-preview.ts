import type { DiffLine } from "../projects/project-workspace";

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

export function writePreview(content: string): DiffLine[] {
  return lines(content).slice(0, PREVIEW_LINES).map((text, index): DiffLine => ({ kind: "add", text, new: index + 1 }));
}

export const lineCount = (text: string) => lines(text).length;
