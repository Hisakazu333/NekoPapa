import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-hover-intent-"));
let hover;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./hover-intent-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), "{\"type\":\"module\"}");
  hover = await import(pathToFileURL(join(output, "navigation/hover-intent.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

/** A manual clock: timers run only when the test advances time. */
function harness() {
  let now = 0;
  let timers = [];
  let open = false;
  const changes = [];
  const intent = hover.createHoverIntent({
    openDelay: 150, closeDelay: 300,
    isOpen: () => open,
    onChange: (next) => { open = next; changes.push(next); },
    schedule: (run, delay) => { const timer = { at: now + delay, run }; timers.push(timer); return timer; },
    cancel: (timer) => { timers = timers.filter((item) => item !== timer); },
  });
  const advance = (ms) => {
    now += ms;
    for (const timer of timers.filter((item) => item.at <= now)) { timers = timers.filter((item) => item !== timer); timer.run(); }
  };
  return { intent, advance, changes, isOpen: () => open, setOpen: (next) => { open = next; } };
}

test("停留到延时才打开，划过不打开", () => {
  const { intent, advance, changes } = harness();
  intent.enter();
  advance(100);
  intent.leave();
  advance(500);
  assert.deepEqual(changes, []);
  intent.enter();
  advance(150);
  assert.deepEqual(changes, [true]);
});

test("离开触发器与面板后才关闭；跨过两者间隙不关闭", () => {
  const { intent, advance, changes } = harness();
  intent.enter();
  advance(150);
  intent.leave(); // trigger → gap
  advance(200);
  intent.enter(); // gap → panel
  advance(1000);
  assert.deepEqual(changes, [true]);
  intent.leave();
  advance(299);
  assert.deepEqual(changes, [true]);
  advance(1);
  assert.deepEqual(changes, [true, false]);
});

test("触屏与触控笔不按悬停打开", () => {
  const { intent, advance, changes } = harness();
  intent.enter("touch");
  intent.enter("pen");
  advance(1000);
  assert.deepEqual(changes, []);
});

test("按下或 Esc 改变状态后取消待定的悬停变化，关闭时忘记指针位置", () => {
  const { intent, advance, changes, setOpen } = harness();
  intent.enter();
  advance(50);
  setOpen(true);
  intent.settle(true); // pressed before the delay
  advance(500);
  assert.deepEqual(changes, []);
  // Choosing an item unmounts the panel without a pointer leave.
  intent.enter();
  setOpen(false);
  intent.settle(false);
  intent.enter();
  advance(150);
  intent.leave();
  advance(300);
  assert.deepEqual(changes, [true, false]);
});
