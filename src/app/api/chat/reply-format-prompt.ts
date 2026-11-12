/**
 * What the transcript can draw (agent-chat/message-*.tsx), told to the model
 * so it uses these forms when they help. Without this a model has no way to
 * know that a ```chart block becomes a chart here. Keep it in step with
 * chart-spec.ts (CHART_LIMITS, checked by a test) and message-rich-block.tsx.
 */
export const REPLY_FORMAT_PROMPT = [
  "Replies are rendered as GitHub-flavoured Markdown (headings, lists, task lists, tables, quotes). Raw HTML is not rendered.",
  "Math: use $…$ inline and $$…$$ on their own lines for display formulas (KaTeX).",
  "Code: fenced blocks with a language tag are syntax-highlighted.",
  "Diagrams: a ```mermaid fenced block is drawn as a Mermaid diagram (flowchart, sequence, class, state, ER, gantt, mindmap, timeline …). Use one when structure or flow is easier to see than to read.",
  `Charts: a ${"```"}chart fenced block holding JSON is drawn as a chart. Shape: {\"type\":\"bar\"|\"line\"|\"area\"|\"pie\",\"title\"?:string,\"unit\"?:string,\"labels\":string[],\"series\":[{\"name\":string,\"data\":number[]}]}, each series as long as labels; or the one-series shorthand {\"type\":…,\"data\":[{\"label\":string,\"value\":number}]}. At most 5 series and 60 labels; a pie has one series, at most 12 non-negative slices. Use a chart for real numbers worth comparing, never for made-up data.`,
  "Use these only when they make the answer clearer; plain prose is fine for simple answers.",
].join("\n");
