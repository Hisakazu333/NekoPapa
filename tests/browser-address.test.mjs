import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-browser-address-"));
let address;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./browser-address-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  address = await import(pathToFileURL(join(output, "browser-address.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const opens = (input) => {
  const result = address.normalizeBrowserAddress(input);
  assert.equal(result.ok, true, `${input}: ${result.reason}`);
  return result.url;
};
const refuses = (input) => {
  const result = address.normalizeBrowserAddress(input);
  assert.equal(result.ok, false, `${input} should be refused`);
  return result.reason;
};

test("full http(s) addresses open as typed", () => {
  assert.equal(opens("https://example.com/docs?q=1#top"), "https://example.com/docs?q=1#top");
  assert.equal(opens("  http://example.org  "), "http://example.org/");
});

test("bare hosts get https, local hosts get http so dev servers open", () => {
  assert.equal(opens("example.com"), "https://example.com/");
  assert.equal(opens("boardui.com/zh-hans/components"), "https://boardui.com/zh-hans/components");
  assert.equal(opens("localhost:5173"), "http://localhost:5173/");
  assert.equal(opens("127.0.0.1:1420/#login"), "http://127.0.0.1:1420/#login");
  assert.equal(opens("app.localhost"), "http://app.localhost/");
  assert.equal(opens("[::1]:8080"), "http://[::1]:8080/");
});

test("other schemes, words and blanks are refused with a reason, never searched", () => {
  for (const input of ["file:///etc/hosts", "javascript:alert(1)", "data:text/html,hi", "tauri://localhost"]) {
    assert.match(refuses(input), /http|格式/);
  }
  assert.match(refuses(""), /请输入网址/);
  assert.match(refuses("how to cook rice"), /暂不支持搜索/);
  assert.match(refuses("notes"), /完整网址/);
});

test("the address bar shows a bare origin without its trailing slash", () => {
  assert.equal(address.displayBrowserAddress("https://example.com/"), "https://example.com");
  assert.equal(address.displayBrowserAddress("https://example.com/a/"), "https://example.com/a/");
});
