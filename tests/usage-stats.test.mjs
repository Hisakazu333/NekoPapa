import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-usage-"));
let stats;
let sankey;
let thread;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./usage-stats-tsconfig.json", import.meta.url)), "--outDir", output]);
  const walk = (dir) => readdirSync(dir).flatMap((name) => statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]);
  for (const file of walk(output).filter((name) => name.endsWith(".js"))) {
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+["'])(\.{1,2}\/[^"']+?)(["'])/g, (_, a, path, b) => `${a}${path.endsWith(".js") ? path : `${path}.js`}${b}`));
  }
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  stats = await import(pathToFileURL(join(output, "app/usage-stats.js")));
  sankey = await import(pathToFileURL(join(output, "app/usage-sankey-layout.js")));
  thread = await import(pathToFileURL(join(output, "app/thread-usage.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

// Tuesday 2026-11-10, local time; fixtures use local calendar dates.
const NOW = new Date(2026, 10, 10, 15).getTime();
const at = (year, month, day, hour = 10) => new Date(year, month, day, hour).getTime();
let sequence = 0;
function reply(time, metadata, role = "assistant") {
  const id = `r${sequence += 1}`;
  return { message: { id, role, parts: [{ type: "text", text: "ok" }], ...(metadata ? { metadata } : {}) }, id, time };
}
function usageThread(replies, extra = {}) {
  const messageAt = {};
  for (const item of replies) if (item.time !== null) messageAt[item.id] = item.time;
  return { id: `u${sequence += 1}`, title: "usage", updatedAt: NOW, messages: replies.map((item) => item.message), messageAt, ...extra };
}
const sourceOf = (thread) => thread.contact ? { key: "contacts", label: "联系人" } : thread.project ? { key: thread.project, label: thread.project } : { key: "none", label: "未归入项目" };
const use = (total, model, provider, extra = {}) => ({ usage: { totalTokens: total, ...extra }, ...(model ? { model } : {}), ...(provider ? { provider } : {}) });

const fixture = () => stats.collectUsageReplies([
  usageThread([
    reply(at(2026, 10, 10, 9), use(150, "gpt-test", "OpenAI", { inputTokens: 100, outputTokens: 50 })),
    reply(at(2026, 10, 10, 12), use(400, "gpt-test", "OpenAI", { inputTokens: 300, outputTokens: 100 })),
    reply(at(2026, 10, 9), use(1000, "claude-test", "Anthropic")),
    reply(at(2026, 10, 9), undefined),
    reply(at(2026, 10, 9), use(5), "user"),
  ], { project: "proj_a" }),
  usageThread([reply(at(2026, 8, 1), use(2000)), reply(null, use(7))]),
  usageThread([reply(at(2025, 10, 1), use(500, "gpt-test", "OpenAI"))], { contact: { id: "c", kind: "custom", name: "C" } }),
], sourceOf);

test("只汇总记录了用量的助手回复：累计、输入输出、今年与去年同期对比、单日峰值与最长连续", () => {
  const replies = fixture();
  assert.equal(replies.length, 6);
  const overview = stats.usageOverview(replies, NOW);
  assert.deepEqual([overview.replies, overview.totalTokens, overview.inputTokens, overview.outputTokens], [6, 4057, 400, 150]);
  assert.equal(overview.yearTokens, 3550, "今年 1 月 1 日至今；无时间的回复不计入年度");
  assert.equal(overview.yearChange, (3550 - 500) / 500, "去年同期（至 11 月 10 日）只有 500");
  assert.deepEqual(overview.peakDay && [overview.peakDay.key, overview.peakDay.tokens], ["2026-09-01", 2000]);
  assert.equal(overview.longestStreak, 2, "11 月 9 日与 10 日连续");
  const empty = stats.usageOverview([], NOW);
  assert.deepEqual([empty.replies, empty.totalTokens, empty.peakDay, empty.yearChange, empty.longestStreak], [0, 0, undefined, undefined, 0]);
});

test("热力图：按日 53 周 × 7 天（周一开始，今天之后为未来）、按周 53 格、按月 12 格；深浅按当前视图最大值分四级", () => {
  const replies = fixture();
  const days = stats.usageHeatmap(replies, NOW, "day");
  assert.equal(days.length, 53);
  assert.ok(days.every((week) => week.length === 7));
  const flat = days.flat();
  const today = flat.find((cell) => cell.key === "2026-11-10");
  assert.deepEqual([today.tokens, today.future], [550, false]);
  assert.equal(flat.find((cell) => cell.key === "2026-11-11").future, true);
  assert.equal(flat.find((cell) => cell.key === "2026-09-01").level, 4);
  assert.equal(today.level, 2, "550 / 2000 → 第 2 级");
  assert.equal(days[0][0].key, "2025-11-10", "第一列从 52 周前的周一开始");

  const weeks = stats.usageHeatmap(replies, NOW, "week");
  assert.deepEqual([weeks.length, weeks.every((column) => column.length === 1)], [53, true]);
  assert.equal(weeks.at(-1)[0].tokens, 1550);
  const months = stats.usageHeatmap(replies, NOW, "month");
  assert.equal(months.length, 12);
  assert.deepEqual(months.at(-1)[0].label, "2026年11月");
  assert.equal(months.at(-1)[0].tokens, 1550);
  assert.equal(months[0][0].label, "2025年12月");
  assert.equal(stats.usageLevel(0, 10), 0);
  assert.equal(stats.usageLevel(1, 1000), 1, "有用量的格子至少为 1 级");
});

test("流向：按时间范围从来源流向模型，未标明模型单独列出，超出数量折叠为“其他”", () => {
  const replies = fixture();
  const week = stats.usageFlow(replies, NOW, "7d");
  assert.equal(week.total, 1550);
  assert.deepEqual(week.sources.map((node) => [node.label, node.tokens]), [["proj_a", 1550]]);
  assert.deepEqual(week.models.map((node) => [node.label, node.detail, node.tokens]), [["claude-test", "Anthropic", 1000], ["gpt-test", "OpenAI", 550]]);
  const all = stats.usageFlow(replies, NOW, "all");
  assert.equal(all.total, 4057, "全部范围包含没有时间的回复");
  assert.deepEqual(all.sources.map((node) => node.label), ["未归入项目", "proj_a", "联系人"]);
  assert.equal(all.models.find((node) => node.label === stats.UNNAMED_MODEL).tokens, 2007);
  assert.equal(all.links.reduce((sum, link) => sum + link.tokens, 0), all.total);
  const folded = stats.usageFlow(replies, NOW, "all", { sources: 2, models: 2 });
  assert.deepEqual(folded.sources.map((node) => [node.label, node.tokens]), [["未归入项目", 2007], ["其他", 2050]]);
  assert.deepEqual(folded.models.map((node) => node.label), [stats.UNNAMED_MODEL, "其他"]);
  assert.equal(folded.links.reduce((sum, link) => sum + link.tokens, 0), 4057);
  assert.deepEqual(stats.usageFlow([], NOW, "30d"), { total: 0, sources: [], models: [], links: [] });
});

test("桑基布局：节点高度按 Token 比例并留间距，每条带在两端的厚度等于其占节点的份额且不重叠", () => {
  const flow = stats.usageFlow(fixture(), NOW, "all");
  const layout = sankey.sankeyLayout(flow, { height: 200, gap: 10 });
  const column = (nodes) => nodes.at(-1).y + nodes.at(-1).height;
  assert.ok(Math.abs(column(layout.sources) - 200) < 1e-6);
  assert.ok(Math.abs(column(layout.models) - 200) < 1e-6);
  for (const node of layout.sources) {
    const bands = layout.links.filter((link) => link.source === node.key);
    assert.ok(Math.abs(bands.reduce((sum, link) => sum + link.h0, 0) - node.height) < 1e-6);
    assert.ok(bands.every((link) => link.y0 >= node.y - 1e-6 && link.y0 + link.h0 <= node.y + node.height + 1e-6));
  }
  for (const node of layout.models) {
    const bands = layout.links.filter((link) => link.target === node.key);
    assert.ok(Math.abs(bands.reduce((sum, link) => sum + link.h1, 0) - node.height) < 1e-6);
  }
  assert.match(sankey.sankeyBandPath(layout.links[0], 0, 100), /^M0,[\d.]+ C50,/);
  assert.deepEqual(sankey.sankeyLayout({ total: 0, sources: [], models: [], links: [] }, { height: 100 }), { sources: [], models: [], links: [] });
});

test("紧凑格式用 K / M / B", () => {
  assert.deepEqual([0, 999, 1000, 1250, 98_765, 123_456, 4_500_000, 7_200_000_000].map(stats.formatTokens), ["0", "999", "1K", "1.3K", "98.8K", "123K", "4.5M", "7.2B"]);
});

test("the composer status bar sums only the usage replies reported", () => {
  const messages = [
    { role: "user", metadata: { usage: { totalTokens: 999 } } },
    { role: "assistant", metadata: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }, model: "model-a" } },
    { role: "assistant" },
    { role: "assistant", metadata: { usage: "broken" } },
    { role: "assistant", metadata: { usage: { inputTokens: 100, outputTokens: 20 }, model: "model-b" } },
  ];
  assert.deepEqual(thread.threadUsage(messages), { totalTokens: 135, inputTokens: 110, outputTokens: 25, replies: 2, model: "model-b",
    latest: { model: "model-b", usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 } } });
  assert.deepEqual(thread.threadUsage([]), { totalTokens: 0, inputTokens: 0, outputTokens: 0, replies: 0 });
  assert.equal(thread.formatTokens(1234), "1,234");
  assert.equal(thread.formatTokens(12000), "12k");
  assert.equal(thread.formatTokens(12345), "12.3k");
  assert.equal(thread.formatTokens(1230000), "1.23M");
  assert.equal(thread.formatTokens(2000000), "2M");
});

test("上下文比例只使用同一条回复记录里的窗口，兼容历史回复和只返回总数的服务", () => {
  const oldReply = { role: "assistant", metadata: { usage: { totalTokens: 50 }, model: "old" } };
  const reply = { role: "assistant", metadata: { usage: { totalTokens: 1000 }, model: "new", contextWindow: 4000 } };
  const usage = thread.threadUsage([oldReply, reply, { role: "assistant" }]);
  assert.deepEqual(usage.latest, reply.metadata);
  assert.equal(thread.contextUsageRatio(usage.latest), 0.25);
  assert.equal(thread.contextUsageRatio(thread.threadUsage([reply, oldReply]).latest), undefined);
  assert.equal(thread.contextUsageRatio(thread.threadUsage([{ ...reply, metadata: { ...reply.metadata, contextWindow: "4000" } }]).latest), undefined);
  assert.equal(thread.contextUsageRatio(thread.threadUsage([{ ...reply, metadata: { ...reply.metadata, contextWindow: 500 } }]).latest), 2);
  assert.equal(thread.contextUsageRatio(thread.threadUsage([{ role: "assistant" }]).latest), undefined);
});
