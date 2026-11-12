import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

/**
 * Splits Markdown prose into its top-level blocks (paragraphs, lists,
 * tables, quotes, display math …) as source slices, so a streaming reply
 * re-renders only the block that is still growing instead of the whole
 * reply on every token. Joining the slices gives back the text exactly.
 * Reference links and footnotes need the whole text in one document, so
 * text with a definition stays one block.
 */
export function splitMarkdownBlocks(text: string): string[] {
  const nodes = parser.parse(text).children;
  if (nodes.length < 2 || nodes.some((node) => node.type === "definition" || node.type === "footnoteDefinition")) return [text];
  const starts = nodes.map((node) => node.position?.start.offset);
  if (starts.some((start) => start === undefined)) return [text];
  const cuts = [0, ...(starts as number[]).slice(1), text.length];
  return cuts.slice(0, -1).map((start, index) => text.slice(start, cuts[index + 1]));
}
