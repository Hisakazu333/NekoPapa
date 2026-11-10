import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-browser-view-"));
let address;
let display;
let pick;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./browser-view-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  address = await import(pathToFileURL(join(output, "browser-address.js")));
  display = await import(pathToFileURL(join(output, "browser-display.js")));
  pick = await import(pathToFileURL(join(output, "browser-pick.js")));
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

test("the browser tab is named by the page title, then its host", () => {
  assert.equal(address.browserTabLabel("https://example.com/a", "  Example Domain "), "Example Domain");
  assert.equal(address.browserTabLabel("https://example.com/a", undefined), "example.com");
  assert.equal(address.browserTabLabel(undefined, ""), "浏览器");
  assert.equal(address.browserTabLabel("not a url", undefined), "浏览器");
});

test("fit mode fills the area and lays out at area width divided by zoom", () => {
  assert.deepEqual(display.browserFrame({ width: 520, height: 600 }, { device: "fit", zoom: 1 }), { x: 0, width: 520, height: 600, zoom: 1, layoutWidth: 520 });
  assert.equal(display.browserFrame({ width: 520, height: 600 }, { device: "fit", zoom: 0.5 }).layoutWidth, 1040);
});

test("a device narrower than the area is a centred column at zoom 100%", () => {
  assert.deepEqual(display.browserFrame({ width: 520, height: 600 }, { device: "phone", zoom: 0.5 }), { x: 65, width: 390, height: 600, zoom: 1, layoutWidth: 390 });
});

test("a device wider than the area fills it, zoomed out to lay out at the device width", () => {
  const frame = display.browserFrame({ width: 520, height: 600 }, { device: "laptop", zoom: 1 });
  assert.equal(frame.width, 520);
  assert.equal(frame.zoom, 0.406);
  assert.ok(Math.abs(frame.width / frame.zoom - 1280) < 2);
});

test("zoom steps move along the menu scale and stop at its ends", () => {
  assert.equal(display.stepBrowserZoom(1, -1), 0.9);
  assert.equal(display.stepBrowserZoom(1, 1), 1.1);
  assert.equal(display.stepBrowserZoom(0.5, -1), 0.5);
  assert.equal(display.stepBrowserZoom(1.5, 1), 1.5);
  assert.equal(display.stepBrowserZoom(0.406, 1), 0.5);
  assert.equal(display.formatBrowserZoom(0.67), "67%");
});

const picked = {
  url: "https://example.com/docs", title: "Docs", selector: "main > h1", tag: "H1", text: "Hello",
  html: "<h1>Hello</h1>", htmlTruncated: false, rect: { x: 1, y: 2, width: 320.4, height: 40 },
  styles: { color: "rgb(0, 0, 0)", "font-size": "32px", "bad name": "x", empty: "" },
};

test("picker replies are read as pending, cancelled, picked or gone", () => {
  assert.deepEqual(pick.readPickState('{"pending":true}'), { kind: "pending" });
  assert.deepEqual(pick.readPickState('{"cancelled":true}'), { kind: "cancelled" });
  assert.deepEqual(pick.readPickState("null"), { kind: "gone" });
  assert.deepEqual(pick.readPickState("not json"), { kind: "gone" });
  const result = pick.readPickState(JSON.stringify(picked));
  assert.equal(result.kind, "picked");
  assert.equal(result.element.tag, "h1");
  assert.deepEqual(result.element.size, { width: 320, height: 40 });
  assert.deepEqual(result.element.styles, { color: "rgb(0, 0, 0)", "font-size": "32px" });
});

test("page content is capped and non-web pages are refused", () => {
  const huge = pick.readPickState(JSON.stringify({ ...picked, html: "x".repeat(9000), text: "y".repeat(900) }));
  assert.equal(huge.element.html.length, 4000);
  assert.equal(huge.element.htmlTruncated, true);
  assert.equal(huge.element.text.length, 500);
  assert.deepEqual(pick.readPickState(JSON.stringify({ ...picked, url: "file:///etc/hosts" })), { kind: "gone" });
  assert.deepEqual(pick.readPickState(JSON.stringify({ ...picked, tag: "<script>" })), { kind: "gone" });
});

test("the draft keeps three elements and replaces a re-picked one", () => {
  const element = pick.readPickState(JSON.stringify(picked)).element;
  let list = [];
  for (const [index, selector] of ["a", "b", "c"].entries()) list = pick.addPageElement(list, { ...element, selector }, String(index)).elements;
  assert.equal(list.length, 3);
  assert.match(pick.addPageElement(list, { ...element, selector: "d" }, "4").error, /最多附带 3 个/);
  const replaced = pick.addPageElement(list, { ...element, selector: "b", text: "new" }, "5").elements;
  assert.deepEqual(replaced.map((item) => item.id), ["0", "2", "5"]);
});

test("an element is written into the message with page, selector, styles and HTML", () => {
  const element = { ...pick.readPickState(JSON.stringify(picked)).element, id: "1" };
  const text = pick.pageElementText(element);
  assert.match(text, /网页元素：Docs（https:\/\/example.com\/docs）/);
  assert.match(text, /选择器：main > h1/);
  assert.match(text, /font-size: 32px/);
  assert.match(text, /```html\n<h1>Hello<\/h1>\n```/);
});
