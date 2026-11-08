import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-live2d-"));
let Live2DPreview, agentModelAsset;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./live2d-preview-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  ({ Live2DPreview } = await import(pathToFileURL(join(output, "live2d-preview.js"))));
  ({ agentModelAsset } = await import(pathToFileURL(join(output, "agent-appearance-assets.js"))));
} finally { rmSync(output, { recursive: true, force: true }); }

function fixture(from) {
  const frames = new Map();
  const previous = { window: globalThis.window, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  globalThis.window = { devicePixelRatio: 2 };
  let sequence = 0, destroyedModels = 0, destroyedApps = 0, rendered = 0, updated = 0;
  globalThis.requestAnimationFrame = (callback) => { frames.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const model = {
    anchor: { set() {} }, scale: { set() {} }, position: { set() {} },
    internalModel: {
      coreModel: { getDrawableCount: () => 1, getDrawableOpacity: () => 1 },
      getDrawableVertices: () => [0, 0, 100, 200], localTransform: { apply: (point) => point },
    },
    update() { updated++; }, destroy() { destroyedModels++; },
  };
  const runtime = {
    Application: class {
      stage = { addChild() {} };
      renderer = { resize() {}, render() { rendered++; } };
      destroy() { destroyedApps++; model.destroy(); }
    },
    Point: class { constructor(x, y) { this.x = x; this.y = y; } },
    live2d: { Live2DModel: { from: from ?? (() => Promise.resolve(model)) } },
  };
  return {
    runtime, model, frames,
    get counts() { return { destroyedModels, destroyedApps, rendered, updated }; },
    tick(time) { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(time); },
    restore() { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } },
  };
}

test("客户端不内置人物模型，官方和自建联系人的模型预览回退头像", () => {
  assert.equal(agentModelAsset({ id: "lumia", kind: "official" }), undefined);
  assert.equal(agentModelAsset({ id: "rinne", kind: "official" }), undefined);
  assert.equal(agentModelAsset({ id: "lumia", kind: "custom" }), undefined);
  assert.equal(agentModelAsset({ id: "contact-private", kind: "custom", appearanceId: "lumia" }), undefined);
  assert.equal(existsSync(fileURLToPath(new URL("../public/live2d/", import.meta.url))), false);
});

test("切换头像或关闭预览后销毁模型、纹理和WebGL应用，重复清理不会重复销毁", async () => {
  const f = fixture();
  try {
    const preview = new Live2DPreview({}, f.runtime);
    preview.resize(300, 400);
    await preview.load("model.json");
    assert.equal(f.frames.size, 1);
    f.tick(34);
    assert.ok(f.counts.updated >= 2);
    preview.destroy(); preview.destroy();
    assert.equal(f.frames.size, 0);
    assert.equal(f.counts.destroyedApps, 1);
    assert.equal(f.counts.destroyedModels, 1);
  } finally { f.restore(); }
});

test("不可见和减少动态效果时暂停帧循环，恢复后重新启动", async () => {
  const f = fixture();
  const preview = new Live2DPreview({}, f.runtime);
  try {
    preview.setActive(false);
    await preview.load("model.json");
    assert.equal(f.frames.size, 0);
    preview.setActive(true);
    assert.equal(f.frames.size, 1);
    preview.setActive(true, true);
    assert.equal(f.frames.size, 0);
    preview.setActive(true, false);
    assert.equal(f.frames.size, 1);
  } finally { preview.destroy(); f.restore(); }
});

test("加载中关闭后异步返回的模型仍被释放，且不创建应用或帧循环", async () => {
  let resolveModel, started;
  const ready = new Promise((resolve) => { started = resolve; });
  const f = fixture(() => { started(); return new Promise((resolve) => { resolveModel = resolve; }); });
  try {
    const preview = new Live2DPreview({}, f.runtime);
    const loaded = preview.load("model.json");
    await ready;
    preview.destroy();
    resolveModel(f.model);
    await loaded;
    assert.equal(f.counts.destroyedModels, 1);
    assert.equal(f.counts.destroyedApps, 0);
    assert.equal(f.frames.size, 0);
  } finally { f.restore(); }
});

test("无可见网格的损坏模型拒绝加载并释放已创建应用", async () => {
  const f = fixture();
  try {
    f.model.internalModel.coreModel.getDrawableCount = () => 0;
    const preview = new Live2DPreview({}, f.runtime);
    await assert.rejects(preview.load("broken.json"), /可见范围无效/);
    assert.equal(f.counts.destroyedApps, 1);
    assert.equal(f.counts.destroyedModels, 1);
    assert.equal(f.frames.size, 0);
  } finally { f.restore(); }
});
