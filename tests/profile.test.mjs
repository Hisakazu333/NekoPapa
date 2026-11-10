import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-profile-"));
let activity;
let identity;
let usage;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./profile-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  // tsc keeps extensionless relative imports; Node's ESM loader needs `.js`.
  const addExtensions = (folder) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name);
      if (entry.isDirectory()) addExtensions(file);
      else if (entry.name.endsWith(".js")) writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`));
    }
  };
  addExtensions(output);
  activity = await import(pathToFileURL(join(output, "app/usage/profile-activity.js")));
  identity = await import(pathToFileURL(join(output, "app/account/profile-identity.js")));
  usage = await import(pathToFileURL(join(output, "app/usage/chat-usage.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

// Tuesday 2026-11-10, local time; every fixture uses local calendar dates.
const NOW = new Date(2026, 10, 10, 15).getTime();
const at = (month, day, hour = 10) => new Date(2026, month, day, hour).getTime();
let sequence = 0;
function thread(times, extra = {}) {
  const messages = [];
  const messageAt = {};
  for (const time of times) {
    const id = `m${sequence += 1}`;
    messages.push({ id, role: "user", parts: [{ type: "text", text: "hi" }] });
    if (time !== null) messageAt[id] = time;
    const reply = `m${sequence += 1}`;
    messages.push({ id: reply, role: "assistant", parts: [{ type: "text", text: "hello" }] });
    messageAt[reply] = time ?? NOW;
  }
  return { id: `t${sequence}`, title: "chat", updatedAt: Math.max(0, ...times.filter(Boolean)), messages, messageAt, ...extra };
}
const dayCount = (result, key) => result.weeks.flat().find((day) => day.key === key)?.count;

test("统计只计算你发送的消息：对话数、消息数、活跃日与热力图格子来自本机记录", () => {
  const result = activity.profileActivity([
    thread([at(10, 10, 9), at(10, 10, 11), at(10, 9)]),
    thread([at(10, 9, 20), null]),
    { id: "empty", title: "draft", updatedAt: NOW, messages: [], messageAt: {} },
  ], NOW);
  assert.equal(result.conversations, 2, "没有发送消息的草稿不算对话");
  assert.equal(result.sentMessages, 5, "缺少时间的消息仍计入总数");
  assert.equal(result.activeDays, 2);
  assert.equal(dayCount(result, "2026-11-10"), 2);
  assert.equal(dayCount(result, "2026-11-09"), 2);
  assert.equal(result.weeks.flat().find((day) => day.key === "2026-11-10").level, 1);
});

test("热力图按周排列、周一开始，最后一列包含今天且之后的日期标记为未来", () => {
  const result = activity.profileActivity([], NOW);
  assert.equal(result.weeks.length, 53);
  assert.ok(result.weeks.every((week) => week.length === 7));
  const last = result.weeks.at(-1);
  assert.equal(last[0].key, "2026-11-09", "周一在第一行");
  assert.equal(last[1].key, "2026-11-10");
  assert.equal(last[1].future, false);
  assert.ok(last.slice(2).every((day) => day.future && day.count === 0));
  assert.equal(result.weeks[0][0].key, "2025-11-10");
  assert.ok(result.months.length >= 12, "每个月在含 1 日的列上标注");
  // 2026-11-01 is a Sunday, so November is labelled on the week that starts 10-26.
  assert.deepEqual(result.months.find((label) => label.month === 10 && label.column > 40), { column: 50, month: 10 });
});

test("活跃等级使用固定阈值，数量增长时含义不变", () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 10, 11, 40].map(activity.activityLevel), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test("连续天数：最长连续跨越全部记录；今天为空时当前连续从昨天算起，中断后归零", () => {
  const history = [thread([at(9, 1), at(9, 2), at(9, 3), at(9, 4), at(10, 8), at(10, 9)])];
  const result = activity.profileActivity(history, NOW);
  assert.equal(result.longestStreak, 4);
  assert.equal(result.currentStreak, 2, "11-08 与 11-09 连续，今天尚无消息");
  const broken = activity.profileActivity([thread([at(10, 7)])], NOW);
  assert.equal(broken.currentStreak, 0);
  assert.equal(broken.longestStreak, 1);
});

test("常用项目只统计工作台对话，按对话数排序并限制数量", () => {
  const result = activity.profileActivity([
    thread([at(10, 1)], { project: "~/Projects/app" }),
    thread([at(10, 2)], { project: "~/Projects/app" }),
    thread([at(10, 3)], { project: "~/Notes" }),
    thread([at(10, 4)], { project: "~/Old" }),
    thread([at(10, 5)], { project: "~/Contact", contact: { id: "c1", kind: "custom" } }),
  ], NOW, { projects: 2 });
  assert.deepEqual(result.projects.map((project) => [project.key, project.conversations]), [["~/Projects/app", 2], ["~/Old", 1]]);

  // Legacy folder paths and project ids of one project count together; removed projects are skipped.
  const keys = { "~/Projects/app": "proj_app", proj_app: "proj_app", "~/Notes": "proj_notes" };
  const merged = activity.profileActivity([
    thread([at(10, 1)], { project: "~/Projects/app" }),
    thread([at(10, 2)], { project: "proj_app" }),
    thread([at(10, 3)], { project: "~/Notes" }),
    thread([at(10, 4)], { project: "proj_removed" }),
  ], NOW, { projectKey: (value) => keys[value] });
  assert.deepEqual(merged.projects.map((project) => [project.key, project.conversations]), [["proj_app", 2], ["proj_notes", 1]]);
});

test("空记录：全部为零，仍生成完整的空热力图", () => {
  const result = activity.profileActivity([], NOW);
  assert.deepEqual([result.conversations, result.sentMessages, result.activeDays, result.longestStreak, result.currentStreak], [0, 0, 0, 0, 0]);
  assert.equal(result.weeks.flat().filter((day) => day.count > 0).length, 0);
  assert.deepEqual(result.projects, []);
});

test("身份：未登录时显示本机资料；登录账号提供名称、头像、NekoID 和套餐", () => {
  const local = { name: "  猫爸  ", biography: "", website: "" };
  assert.deepEqual(identity.profileIdentity(local), { name: "猫爸", initials: "猫爸", source: "local" });
  assert.deepEqual(identity.profileIdentity({ ...local, name: " " }).name, "NekoPapa 用户");
  assert.deepEqual(identity.profileIdentity(local, { userName: "hisa", nekoId: "neko123", avatarUrl: "https://example.test/a.png", cloudPlanCode: "PRO" }), {
    name: "hisa", initials: "HI", handle: "@neko123", avatarUrl: "https://example.test/a.png", plan: "PRO", source: "account",
  });
  assert.equal(identity.profileIdentity(local, { userName: "" }).name, "猫爸", "账号没有名称时沿用本机名称");
  assert.equal(identity.profileIdentity(local, {}).handle, undefined);
});

test("回复用量：只保存模型服务返回的计数，缺少总数时由输入与输出相加，没有计数时不写入", () => {
  assert.deepEqual(usage.chatReplyMetadata({ inputTokens: 120, outputTokens: 30.4, totalTokens: 150 }, { model: " gpt-test ", provider: "OpenAI" }),
    { usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 }, model: "gpt-test", provider: "OpenAI" });
  assert.deepEqual(usage.chatReplyMetadata({ inputTokens: 10, outputTokens: undefined, totalTokens: undefined }), { usage: { inputTokens: 10, totalTokens: 10 } });
  assert.equal(usage.chatReplyMetadata({ inputTokens: undefined, outputTokens: undefined, totalTokens: undefined }, { model: "m" }), undefined);
  assert.equal(usage.chatReplyMetadata({ inputTokens: -1, outputTokens: Number.NaN }), undefined);
  assert.equal(usage.readChatUsage({ usage: "lots" }), undefined, "损坏的元数据被忽略");
  assert.equal(usage.readChatUsage(null), undefined);
  assert.deepEqual(usage.readChatUsage({ usage: { totalTokens: 9 }, model: 42 }), { usage: { totalTokens: 9 } });
});
