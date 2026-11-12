import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Rich reply content: chart blocks, LaTeX delimiters and code highlighting (agent-chat/message-*.tsx).
const output = mkdtempSync(join(tmpdir(), "nekopapa-message-content-"));
let chart, blocks, highlight, markdown, prompt;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./message-content-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  symlinkSync(fileURLToPath(new URL("../node_modules", import.meta.url)), join(output, "node_modules"), "dir");
  chart = await import(pathToFileURL(join(output, "app/chat/chart-spec.js")));
  blocks = await import(pathToFileURL(join(output, "app/chat/message-blocks.js")));
  highlight = await import(pathToFileURL(join(output, "app/chat/code-highlight.js")));
  markdown = await import(pathToFileURL(join(output, "app/chat/markdown-blocks.js")));
  prompt = await import(pathToFileURL(join(output, "app/api/chat/reply-format-prompt.js")));
} catch (error) { rmSync(output, { recursive: true, force: true }); throw error; }
// Shiki loads lazily from the compiled module's folder, so it stays until the tests end.
test.after(() => rmSync(output, { recursive: true, force: true }));

const ok = (spec) => {
  const result = chart.checkChart(JSON.stringify(spec));
  assert.equal(result.ok, true, result.ok ? "" : result.errors.join("\n"));
  return result.chart;
};
const errors = (source) => {
  const result = chart.checkChart(typeof source === "string" ? source : JSON.stringify(source));
  assert.equal(result.ok, false);
  return result.errors.join("\n");
};

test("chart blocks: series and the one-series shorthand become the same checked chart", () => {
  assert.deepEqual(ok({ type: "bar", title: "月度", unit: "万元", labels: ["1月", "2月"], series: [{ name: "收入", data: [3, 4] }, { name: "支出", data: [1, -2] }] }),
    { type: "bar", title: "月度", unit: "万元", labels: ["1月", "2月"], series: [{ name: "收入", data: [3, 4] }, { name: "支出", data: [1, -2] }] });
  assert.deepEqual(ok({ type: "pie", data: [{ label: "A", value: 2 }, { label: 2024, value: 1 }] }),
    { type: "pie", labels: ["A", "2024"], series: [{ name: "数值", data: [2, 1] }] });
});

test("chart blocks: every problem is listed and nothing is guessed", () => {
  assert.match(errors("{nope"), /不是有效的 JSON/);
  assert.match(errors("[1,2]"), /必须是一个对象/);
  assert.match(errors({ type: "radar", labels: ["a"], series: [{ name: "x", data: [1] }] }), /type 只能是/);
  assert.match(errors({ type: "bar", labels: ["a", "b"], series: [{ name: "x", data: [1] }] }), /有 1 个值，labels 有 2 个/);
  assert.match(errors({ type: "line", labels: ["a"], series: [{ name: "x", data: ["1"] }] }), /数字数组/);
  assert.match(errors({ type: "line", labels: ["a"], series: [{ data: [1] }] }), /name 必填/);
  assert.match(errors({ type: "bar", labels: ["a"], series: Array.from({ length: 6 }, (_, index) => ({ name: `s${index}`, data: [1] })) }), /最多 5 组/);
  assert.match(errors({ type: "pie", data: [{ label: "a", value: -1 }, { label: "b", value: 2 }] }), /不能为负/);
  assert.match(errors({ type: "pie", data: [{ label: "a", value: 0 }] }), /总和必须大于 0/);
  assert.match(errors({ type: "pie", labels: ["a"], series: [{ name: "x", data: [1] }, { name: "y", data: [1] }] }), /只能有一组/);
  assert.match(errors({ type: "bar", data: [{ label: "a" }] }), /label（文本）和 value（数字）/);
});

test("chart axes use round ticks that cover the data, including negatives", () => {
  assert.deepEqual(chart.niceTicks(0, 87), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(chart.niceTicks(-30, 45), [-40, -20, 0, 20, 40, 60]);
  assert.deepEqual(chart.niceTicks(0, 0), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.equal(chart.formatValue(1200), "1200");
  assert.equal(chart.formatValue(35000), "35k");
  assert.equal(chart.formatValue(3500000), "3.5M");
  assert.equal(chart.formatValue(0.125), "0.13");
});

test("LaTeX written as \\( \\) and \\[ \\] becomes Markdown math, but not inside inline code or when escaped", () => {
  assert.equal(blocks.normalizeMathDelimiters("面积 \\(\\pi r^2\\) 公式"), "面积 $\\pi r^2$ 公式");
  assert.equal(blocks.normalizeMathDelimiters("\\[ E = mc^2 \\]"), "\n$$\nE = mc^2\n$$\n");
  assert.equal(blocks.normalizeMathDelimiters("代码 `\\(x\\)` 保留"), "代码 `\\(x\\)` 保留");
  assert.equal(blocks.normalizeMathDelimiters("转义 \\\\(x\\\\) 保留"), "转义 \\\\(x\\\\) 保留");
  assert.equal(blocks.normalizeMathDelimiters("没有公式"), "没有公式");
  assert.equal(blocks.normalizeMathDelimiters("块公式：\n$$x^2$$\n后文"), "块公式：\n$$\nx^2\n$$\n后文");
  assert.equal(blocks.normalizeMathDelimiters("价格 $$5 和 $$6 元"), "价格 $$5 和 $$6 元");
});

test("code highlighting resolves aliases, keeps the text and leaves unknown languages plain", async () => {
  const lines = await highlight.highlightCode("const a = 1;\nlet b", "ts");
  assert.equal(lines.length, 2);
  assert.equal(lines.map((line) => line.map((token) => token.content).join("")).join("\n"), "const a = 1;\nlet b");
  assert.ok(lines[0].some((token) => token.light && token.dark && token.light !== token.dark));
  assert.equal(await highlight.highlightCode("x", "not-a-language"), undefined);
  assert.equal(await highlight.highlightCode("x", "text"), undefined);
  assert.equal(highlight.highlightLanguage("sh"), "bash");
});

test("streaming prose splits into top-level blocks that join back to the exact text", () => {
  const text = "# 标题\n\n第一段\n续行\n\n- a\n\n- b\n\n$$\nx^2\n\ny\n$$\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n> 引用";
  const parts = markdown.splitMarkdownBlocks(text);
  assert.equal(parts.join(""), text);
  assert.deepEqual(parts.map((part) => part.trim().split("\n")[0]), ["# 标题", "第一段", "- a", "$$", "| a | b |", "> 引用"]);
  // A display formula still streaming stays one block.
  assert.deepEqual(markdown.splitMarkdownBlocks("前文\n\n$$\na\n\nb"), ["前文\n\n", "$$\na\n\nb"]);
  // Reference links and footnotes need the whole document.
  const linked = "见 [文档][d]\n\n下一段\n\n[d]: https://example.com";
  assert.deepEqual(markdown.splitMarkdownBlocks(linked), [linked]);
  assert.deepEqual(markdown.splitMarkdownBlocks("只有一段"), ["只有一段"]);
});

test("the model is told which fenced blocks the transcript draws, with the chart limits it enforces", () => {
  const text = prompt.REPLY_FORMAT_PROMPT;
  for (const fence of ["```mermaid", "```chart"]) assert.ok(text.includes(fence), fence);
  const { series, labels, pieSlices } = chart.CHART_LIMITS;
  assert.ok(text.includes(`At most ${series} series and ${labels} labels`));
  assert.ok(text.includes(`at most ${pieSlices} non-negative slices`));
  assert.equal(chart.checkChart(JSON.stringify({ type: "bar", labels: Array.from({ length: 61 }, (_, i) => `${i}`), series: [{ name: "x", data: Array(61).fill(1) }] })).ok, false);
});
