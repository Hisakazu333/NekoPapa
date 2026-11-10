import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-chat-provider-status-"));
let status;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./chat-provider-status-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  const module = join(output, "chat-provider-status.js");
  writeFileSync(module, readFileSync(module, "utf8").replace('"./official-companion-service"', '"./official-companion-service.js"'));
  status = await import(pathToFileURL(module));
} finally { rmSync(output, { recursive: true, force: true }); }

const { parseChatProviderProbe, chatContactAvailability } = status;
const official = { kind: "official" };
const custom = { kind: "custom" };

test("通用模型已连接不等于官方人物服务已连接", () => {
  const probe = parseChatProviderProbe({ configured: true, provider: "openai", model: "test-model", officialCompanions: { configured: false, reason: "官方人物服务尚未连接" } });
  assert.equal(chatContactAvailability(probe).ready, true);
  assert.equal(chatContactAvailability(probe, custom).ready, true);
  assert.deepEqual(chatContactAvailability(probe, official), { ready: false, reason: "官方人物服务尚未连接" });
  assert.equal(probe.model, "test-model");
});

test("旧接口、失败探测和非法官方服务状态均不能开放官方人物发送", () => {
  for (const value of [null, undefined, {}, "error", { configured: true }, { officialCompanions: true }, { officialCompanions: { configured: "true" } }]) {
    const probe = parseChatProviderProbe(value);
    assert.equal(chatContactAvailability(probe, custom).ready, true);
    assert.deepEqual(chatContactAvailability(probe, official), { ready: false, reason: "官方人物服务尚未连接，暂时无法发送消息。" });
  }
});

test("官方服务使用自己的状态，不受自定义模型是否配置影响", () => {
  const probe = parseChatProviderProbe({ configured: false, officialCompanions: { configured: true, reason: "旧错误不能残留" } });
  assert.equal(chatContactAvailability(probe, custom).ready, false);
  assert.equal(chatContactAvailability(probe).ready, false);
  assert.deepEqual(chatContactAvailability(probe, official), { ready: true, reason: undefined });
  // A saved 模型与 API profile answers without the runtime's own key; official companions still need their service.
  assert.match(chatContactAvailability(probe, custom).reason, /设置 → 模型与 API/);
  assert.equal(chatContactAvailability(probe, custom, true).ready, true);
  assert.equal(chatContactAvailability(probe, custom, true).reason, undefined);
  assert.equal(chatContactAvailability(probe, undefined, true).ready, true);
  assert.deepEqual(chatContactAvailability(parseChatProviderProbe({ configured: false }), official, true).ready, false);
  assert.equal(probe.officialCompanions.reason, null);
});

test("检查连接时官方人物保留草稿并明确等待状态", () => {
  const probe = { ...parseChatProviderProbe(null), status: "checking" };
  assert.deepEqual(chatContactAvailability(probe, official), { ready: false, reason: "正在检查官方人物服务连接…" });
  assert.equal(chatContactAvailability(probe, custom).ready, false);
  assert.equal(chatContactAvailability(probe, custom).reason, "正在检查聊天服务…");
});
