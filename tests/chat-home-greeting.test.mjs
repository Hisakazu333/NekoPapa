import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-greeting-"));
let greeting;
let language;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./chat-home-greeting-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  greeting = await import(pathToFileURL(join(output, "agent-chat/chat-home-greeting.js")));
  language = await import(pathToFileURL(join(output, "language/application-language-copy.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

test("every hour of the day maps to a period with its own lines", () => {
  const periods = Array.from({ length: 24 }, (_, hour) => greeting.greetingPeriod(hour));
  assert.deepEqual([...new Set(periods)].sort(), Object.keys(greeting.homeGreetings).sort());
  assert.equal(greeting.greetingPeriod(4), "dawn");
  assert.equal(greeting.greetingPeriod(5), "morning");
  assert.equal(greeting.greetingPeriod(13), "noon");
  assert.equal(greeting.greetingPeriod(16), "afternoon");
  assert.equal(greeting.greetingPeriod(18), "evening");
  assert.equal(greeting.greetingPeriod(22), "night");
  assert.equal(greeting.greetingPeriod(23), "dawn");
});

test("the roll picks a line within the period, including the top edge", () => {
  const lines = greeting.homeGreetings.morning;
  assert.equal(greeting.homeGreeting(8, 0), lines[0]);
  assert.equal(greeting.homeGreeting(8, 0.9999), lines[lines.length - 1]);
  assert.equal(greeting.homeGreeting(8, 1), lines[lines.length - 1]);
});

test("every greeting has an English line and round-trips to Chinese", () => {
  for (const line of Object.values(greeting.homeGreetings).flat()) {
    const english = language.translateApplicationCopy(line, "en-US");
    assert.notEqual(english, line, `missing English for ${line}`);
    assert.equal(language.translateApplicationCopy(english, "zh-CN"), line);
  }
});
