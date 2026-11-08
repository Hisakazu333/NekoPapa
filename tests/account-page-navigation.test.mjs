import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-account-page-navigation-"));
let module;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./account-page-navigation-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  module = await import(pathToFileURL(join(output, "app/account-page-navigation.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const {
  captureAccountPageFocusTarget,
  createAccountPageNavigation,
  restoreAccountPageFocusTarget,
  ACCOUNT_PAGE_HISTORY_KEY,
} = module;

test("账号菜单触发按钮仍连接时，返回登录页后恢复该按钮焦点", () => {
  const trigger = { isConnected: true, focused: false, focus() { this.focused = true; } };
  const target = captureAccountPageFocusTarget(trigger, null);
  let restore;
  restoreAccountPageFocusTarget(target, (callback) => { restore = callback; });
  assert.equal(trigger.focused, false);
  restore();
  assert.equal(trigger.focused, true);
});

test("直接访问登录页或缺少有效触发按钮时，不强制设置返回焦点", () => {
  let scheduled = false;
  const schedule = () => { scheduled = true; };
  const detachedTrigger = { isConnected: false, focus() { assert.fail("已卸载的触发按钮不应获得焦点"); } };
  assert.equal(captureAccountPageFocusTarget(null, detachedTrigger), null);
  restoreAccountPageFocusTarget(null, schedule);
  restoreAccountPageFocusTarget(detachedTrigger, schedule);
  assert.equal(scheduled, false);
});

function createHistory(initialHash = "", initialState = null) {
  const entries = [{ hash: initialHash, state: initialState }];
  const listeners = new Set();
  let index = 0;
  const current = () => entries[index];
  return {
    entries,
    getHash: () => current().hash,
    getState: () => current().state,
    push(state, hash) { entries.splice(index + 1); entries.push({ state, hash }); index += 1; },
    replace(state, hash) { entries[index] = { state, hash }; },
    back() { if (index > 0) { index -= 1; for (const listener of listeners) listener(); } },
    forward() { if (index < entries.length - 1) { index += 1; for (const listener of listeners) listener(); } },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    emit() { for (const listener of listeners) listener(); },
  };
}

test("打开登录保留现有路由状态，重复打开不重复压入历史，关闭返回原 hash", () => {
  const state = { workspace: "current", scroll: 42 };
  const history = createHistory("#contacts", state);
  const navigation = createAccountPageNavigation(history);
  navigation.open();
  assert.equal(navigation.getSnapshot(), true);
  assert.equal(history.entries.length, 2);
  assert.deepEqual(history.getState().workspace, "current");
  assert.equal(history.getState().scroll, 42);
  assert.deepEqual(history.getState()[ACCOUNT_PAGE_HISTORY_KEY], {
    namespace: "nekopapa.account-page-navigation", version: 1, returnHash: "#contacts",
  });
  navigation.open();
  assert.equal(history.entries.length, 2);
  navigation.close();
  assert.equal(history.getHash(), "#contacts");
  assert.equal(navigation.getSnapshot(), false);
});

test("浏览器后退和前进更新登录可见状态，离开期间不重复通知", () => {
  const history = createHistory();
  const navigation = createAccountPageNavigation(history);
  let changes = 0;
  const unsubscribe = navigation.subscribe(() => changes++);
  navigation.open();
  assert.equal(changes, 1);
  history.back();
  assert.equal(navigation.getSnapshot(), false);
  history.forward();
  assert.equal(navigation.getSnapshot(), true);
  assert.equal(changes, 3);
  unsubscribe();
  assert.equal(history.entries.length, 2);
});

test("刷新后仍能识别应用创建的登录历史项并返回，不替换其原始页面状态", () => {
  const history = createHistory("#contacts", { route: "contacts" });
  createAccountPageNavigation(history).open();
  const refreshedNavigation = createAccountPageNavigation(history);
  assert.equal(refreshedNavigation.getSnapshot(), true);
  refreshedNavigation.close();
  assert.equal(history.getHash(), "#contacts");
  assert.deepEqual(history.getState(), { route: "contacts" });
});

test("直接打开或刷新 #login 后关闭只替换为站内根路由，不执行 history.back", () => {
  const history = createHistory("#login", { unrelated: "keep" });
  const navigation = createAccountPageNavigation(history);
  assert.equal(navigation.getSnapshot(), true);
  navigation.close();
  assert.equal(history.getHash(), "");
  assert.equal(history.entries.length, 1);
  assert.deepEqual(history.getState(), { unrelated: "keep" });
});

test("不可信或格式错误的登录历史标记不会触发后退", () => {
  const history = createHistory("#login", {
    [ACCOUNT_PAGE_HISTORY_KEY]: { namespace: "other-app", version: 1, returnHash: "https://example.com" },
  });
  const navigation = createAccountPageNavigation(history);
  navigation.close();
  assert.equal(history.getHash(), "");
  assert.equal(history.entries.length, 1);
});

test("登录历史标记中的登录回跳地址会被清理，但关闭仍返回应用上一页", () => {
  const history = createHistory("#contacts", { route: "contacts" });
  history.push({
    [ACCOUNT_PAGE_HISTORY_KEY]: {
      namespace: "nekopapa.account-page-navigation", version: 1, returnHash: "#login",
    },
  }, "#login");
  const navigation = createAccountPageNavigation(history);
  navigation.close();
  assert.equal(history.getHash(), "#contacts");
});

test("取消订阅会移除底层导航监听，非登录路由调用 close 不改历史", () => {
  const history = createHistory("#contacts", { route: "contacts" });
  const navigation = createAccountPageNavigation(history);
  let changes = 0;
  const unsubscribe = navigation.subscribe(() => changes++);
  unsubscribe();
  history.entries[0] = { hash: "#contacts", state: null };
  history.emit();
  assert.equal(changes, 0);
  navigation.close();
  assert.equal(history.getHash(), "#contacts");
});
