/**
 * @ mentions in the composer: the `@query` the caret is in, the project files
 * that match it best, and the text after one is picked. A mention starts at
 * the start of the text or after whitespace and runs to the caret; a picked
 * path containing spaces is quoted (@"a b/c.ts").
 */
export interface MentionQuery { start: number; query: string }

export function mentionQuery(text: string, caret: number): MentionQuery | undefined {
  const before = text.slice(0, caret);
  const match = /(?:^|\s)@([^\s@"]*)$/.exec(before);
  if (!match) return undefined;
  return { start: caret - match[1].length - 1, query: match[1] };
}

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

function subsequence(text: string, query: string): boolean {
  let at = 0;
  for (const char of text) if (char === query[at] && ++at === query.length) return true;
  return query.length === 0;
}

/**
 * Best matches first: the file name equal to the query, starting with it,
 * containing it; then the path containing it; then its letters in order
 * along the path. Shorter paths win ties. With no query, the shallowest files.
 */
export function rankMentions(paths: readonly string[], query: string, limit = 8): string[] {
  const needle = query.toLowerCase();
  const scored: { path: string; score: number }[] = [];
  for (const path of paths) {
    const lower = path.toLowerCase();
    const name = baseName(lower);
    const score = !needle ? lower.split("/").length
      : name === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2
        : lower.includes(needle) ? 3 : subsequence(lower, needle) ? 4 : -1;
    if (score >= 0) scored.push({ path, score });
  }
  scored.sort((a, b) => a.score - b.score || a.path.length - b.path.length || (a.path < b.path ? -1 : 1));
  return scored.slice(0, limit).map((item) => item.path);
}

/** The text with the mention at `query` replaced by the picked path, and where the caret goes. */
export function insertMention(text: string, query: MentionQuery, caret: number, path: string): { text: string; caret: number } {
  const token = /\s/.test(path) ? `@"${path}"` : `@${path}`;
  const after = text.slice(caret);
  const inserted = `${token}${after.startsWith(" ") ? "" : " "}`;
  return { text: text.slice(0, query.start) + inserted + after, caret: query.start + inserted.length + (after.startsWith(" ") ? 1 : 0) };
}
