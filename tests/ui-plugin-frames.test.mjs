import test from "node:test";
import assert from "node:assert/strict";
import { manifest } from "./ui-plugins-fixture.mjs";
import { compilePluginModules } from "./ui-plugins-compile.mjs";

// Interface plugins' sandboxed frame views (docs/plugin-slots.md, stage 3):
// the manifest entry, what an enabled plugin adds, the served paths and CSP,
// and the bridge calls a page may make. src-tauri/src/plugin_frame.rs has
// the desktop host's own tests.
const { check, records, contributions, bridge, paths } = await compilePluginModules();

const frameView = (entry, extra = {}) => manifest({
  contributes: { "workPanel.view": [{ id: "board", title: "看板", content: { kind: "frame", entry }, ...extra }] },
});
const checked = (value) => check.checkPluginManifest(JSON.stringify(value));

test("a frame view names an .html file inside the plugin folder, and nothing else", () => {
  const result = checked(frameView("ui/index.html"));
  assert.equal(result.ok, true, result.ok ? "" : result.errors.join("\n"));
  assert.deepEqual(result.manifest.views[0].content, { kind: "frame", entry: "ui/index.html" });
  for (const entry of ["../index.html", "/abs/index.html", "ui/../x.html", ".hidden/index.html", "ui\\index.html", "index.js", "a b.html", "", "https://evil.example/x.html"]) {
    const bad = checked(frameView(entry));
    assert.equal(bad.ok, false, entry);
    assert.match(bad.errors.join(), /content\.entry/, entry);
  }
  assert.equal(checked(frameView(`${"a/".repeat(12)}index.html`)).ok, false);
});

test("an enabled frame view carries its page, folder, granted permissions and settings fields; stored records keep it", () => {
  const { manifest: plugin } = checked(frameView("index.html"));
  const list = records.addPlugin([], "/plugins/board", plugin);
  const [view] = contributions.pluginContributions(list).views;
  assert.equal(view.status, undefined);
  assert.deepEqual(view.frame, { entry: "index.html", folder: "/plugins/board", granted: ["link.open"], fields: [] });
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } };
  assert.equal(records.writePluginRecords(storage, list), true);
  assert.deepEqual(records.readPluginRecords(storage).records[0].manifest.views[0].content, { kind: "frame", entry: "index.html" });
  assert.equal(contributions.pluginContributions(records.setPluginEnabled(list, plugin.id, false)).views.length, 0);
});

test("served paths split into a plugin id and safe segments", () => {
  assert.deepEqual(paths.splitFramePath("acme.board/ui/index.html"), { pluginId: "acme.board", segments: ["ui", "index.html"] });
  for (const path of ["acme.board/../x.html", "acme.board/%2e%2e/x.html", "acme.board/ui%2Findex.html", "acme.board/.env", "Acme/x.html", "acme.board/", "acme.board/%E0%A4%A"]) {
    assert.equal(paths.splitFramePath(path), undefined, path);
  }
  assert.equal(paths.frameFileType("app.MJS"), "text/javascript; charset=utf-8");
  assert.equal(paths.frameFileType("module.wasm"), undefined);
});

test("the frame CSP allows only the plugin's own files and the bridge, with no network, frames or forms", () => {
  const csp = paths.frameCsp("acme.board", ["http://127.0.0.1:1495/plugin-frame/"]);
  assert.match(csp, /script-src http:\/\/127\.0\.0\.1:1495\/plugin-frame\/acme\.board\/ http:\/\/127\.0\.0\.1:1495\/__sdk\/;/);
  for (const rule of ["default-src 'none'", "connect-src 'none'", "frame-src 'none'", "worker-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) assert.ok(csp.includes(rule), rule);
  assert.ok(!/script-src[^;]*'unsafe-(inline|eval)'/.test(csp));
});

const host = (permissions = []) => {
  const calls = { links: [], notices: [] };
  return {
    calls,
    host: {
      context: { pluginId: "acme.board", viewId: "acme.board/board", permissions },
      settings: () => ({ team: "core" }),
      openLink: (url) => calls.links.push(url),
      notify: (text) => calls.notices.push(text),
    },
  };
};
const ask = (target, method, params, allow) => bridge.handleBridgeMessage({ type: "request", id: 7, method, params }, target, allow);

test("bridge: context and the plugin's own settings are always readable", async () => {
  const { host: target } = host(["link.open"]);
  assert.deepEqual(await ask(target, "context.get"), { type: "response", id: 7, result: { pluginId: "acme.board", viewId: "acme.board/board", permissions: ["link.open"] } });
  assert.deepEqual((await ask(target, "settings.get")).result, { team: "core" });
});

test("bridge: link.open needs the granted permission and an https address", async () => {
  const denied = host();
  assert.equal((await ask(denied.host, "link.open", { url: "https://example.com" })).error.code, "permission_denied");
  assert.deepEqual(denied.calls.links, []);
  const granted = host(["link.open"]);
  for (const url of ["http://example.com", "javascript:alert(1)", "https://user:pw@example.com", 42]) {
    assert.equal((await ask(granted.host, "link.open", { url })).error.code, "invalid_params", String(url));
  }
  assert.deepEqual(await ask(granted.host, "link.open", { url: "https://example.com/a b" }), { type: "response", id: 7, result: null });
  assert.deepEqual(granted.calls.links, ["https://example.com/a%20b"]);
});

test("bridge: notices are short and rate-limited; later and unknown methods say so; non-requests are ignored", async () => {
  const { host: target, calls } = host();
  let now = 0;
  const allow = bridge.notifyLimiter(2000, () => now);
  assert.equal((await ask(target, "ui.notify", { text: "已同步" }, allow)).result, null);
  assert.equal((await ask(target, "ui.notify", { text: "又一条" }, allow)).error.code, "rate_limited");
  now = 2500;
  assert.equal((await ask(target, "ui.notify", { text: "x".repeat(201) }, allow)).error.code, "invalid_params");
  assert.equal((await ask(target, "ui.notify", { text: "再一条" }, allow)).result, null);
  assert.deepEqual(calls.notices, ["已同步", "再一条"]);
  for (const method of ["chat.read", "chat.draft", "project.read"]) assert.equal((await ask(target, method)).error.code, "not_available", method);
  assert.equal((await ask(target, "shell.run")).error.code, "unknown_method");
  assert.equal((await ask(target, "constructor")).error.code, "unknown_method");
  assert.equal((await bridge.handleBridgeMessage({ type: "request", id: 1, method: 5 }, target)).error.code, "bad_request");
  for (const message of [null, "x", { type: "theme" }, { type: "request", method: "context.get" }, { type: "request", id: {}, method: "context.get" }]) {
    assert.equal(await bridge.handleBridgeMessage(message, target), undefined);
  }
});

test("bridge theme maps the app's semantic tokens to --np-* variables and skips empty ones", () => {
  const theme = bridge.bridgeTheme(true, (token) => token === "--color-text-primary" ? " #fafafa " : token === "--font-sans" ? "Inter" : "");
  assert.deepEqual(theme, { mode: "dark", variables: { "--np-text": "#fafafa", "--np-font-sans": "Inter" } });
  assert.ok(Object.keys(bridge.THEME_TOKENS).every((name) => /^--np-[a-z0-9-]+$/.test(name)));
});
