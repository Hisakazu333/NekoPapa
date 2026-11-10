import type { DiffLine } from "./project-workspace";

export type ChangedLine = Extract<DiffLine, { kind: "add" | "del" | "ctx" }>;
export interface SplitRow { left?: ChangedLine; right?: ChangedLine; header?: string }

/** Pairs each run of removed lines with the added lines that follow it, side by side. */
export function splitRows(lines: readonly DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let dels: ChangedLine[] = [];
  let adds: ChangedLine[] = [];
  const flush = () => {
    for (let index = 0; index < Math.max(dels.length, adds.length); index++) rows.push({ left: dels[index], right: adds[index] });
    dels = [];
    adds = [];
  };
  for (const line of lines) {
    if (line.kind === "del") { if (adds.length) flush(); dels.push(line); continue; }
    if (line.kind === "add") { adds.push(line); continue; }
    flush();
    if (line.kind === "ctx") rows.push({ left: line, right: line });
    else rows.push({ header: line.text });
  }
  flush();
  return rows;
}
