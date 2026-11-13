import type { UIMessage } from "ai";
import { readFileChange } from "./agent-host";
import { isToolUIPart, toolName } from "./message-segments";

/** One file a reply changed, over all its writes and edits to it. */
export interface RunFileChange {
  path: string;
  /** The reply created the file (its first change made it). */
  created: boolean;
  added: number;
  removed: number;
}

export interface RunChanges {
  files: RunFileChange[];
  /** Every change's snapshot, newest first: the order that undoes them all. */
  snapshots: string[];
  /** How many writes and edits the reply made. */
  count: number;
}

/**
 * What a reply changed in the project, for the summary under it: each file
 * once with its lines added and removed summed, in the order first touched.
 * Read from the write and edit results saved in the reply.
 */
export function runChanges(parts: UIMessage["parts"]): RunChanges {
  const files = new Map<string, RunFileChange>();
  const snapshots: string[] = [];
  for (const part of parts) {
    if (!isToolUIPart(part) || part.state !== "output-available") continue;
    const name = toolName(part);
    if (name !== "write_file" && name !== "edit_file") continue;
    const change = readFileChange(part.output);
    if (!change) continue;
    snapshots.unshift(change.snapshot);
    const file = files.get(change.path);
    if (file) { file.added += change.added; file.removed += change.removed; }
    else files.set(change.path, { path: change.path, created: change.created, added: change.added, removed: change.removed });
  }
  return { files: [...files.values()], snapshots, count: snapshots.length };
}
