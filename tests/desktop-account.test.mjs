import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-desktop-account-"));
let apiModule;
let contract;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./desktop-account-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  const path = join(output, "desktop-account-api.js");
  writeFileSync(path, readFileSync(path, "utf8").replace('"./desktop-account-contract"', '"./desktop-account-contract.js"'));
  apiModule = await import(pathToFileURL(path));
  contract = await import(pathToFileURL(join(output, "desktop-account-contract.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const { createDesktopAccountApi, desktopAccountApi, DesktopAccountUnavailableError } = apiModule;
const { DesktopAccountBusinessError, DesktopAccountContractError } = contract;
const ok = (data) => ({ code: 200, msg: "操作成功", ...(data === undefined ? {} : { data }) });
const signal = () => new AbortController().signal;
const device = { sessionId: "dl_session", deviceCode: "device-code" };
const startData = { ...device, qrText: "nekobuddy://login/confirm?sessionId=dl_session&deviceCode=device-code", expireSeconds: 300, pollIntervalMs: 1500 };
const userInfo = { userId: 42, userName: "测试昵称", avatarUrl: "https://example.test/avatar.png", nekoId: "cat_001", createTime: "2026-11-08 12:00:00" };

test("生产账号 API 未绑定时所有操作明确未连接且不调用 fetch", async () => {
  let networkCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { networkCalls += 1; throw new Error("unexpected network"); };
  try {
    assert.deepEqual(desktopAccountApi.availability, { kind: "disabled", reason: "backend-restructuring" });
    assert.equal(Object.isFrozen(desktopAccountApi), true);
    assert.equal(Object.isFrozen(desktopAccountApi.availability), true);
    for (const call of [
      () => desktopAccountApi.start({}, signal()),
      () => desktopAccountApi.poll(device, signal()),
      () => desktopAccountApi.profile(signal()),
      () => desktopAccountApi.logout(signal()),
      () => desktopAccountApi.poll(null, AbortSignal.abort()),
    ]) await assert.rejects(call, DesktopAccountUnavailableError);
    assert.equal(networkCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("扫码创建和轮询使用 Java 真实路径与请求白名单", async () => {
  const calls = [];
  const api = createDesktopAccountApi(async (request) => {
    calls.push(request);
    return ok(request.path.endsWith("/start") ? { ...startData, token: "discard" } : { status: "WAITING" });
  });
  assert.deepEqual(api.availability, { kind: "available" });
  const cancellation = signal();
  const started = await api.start({ deviceId: "desktop-1", deviceName: "Mac", clientVersion: "0.1.0", clientType: "ignored", token: "ignored" }, cancellation);
  assert.deepEqual(started, startData);
  assert.deepEqual(calls[0], { method: "POST", path: "/api/app/auth/device/start", signal: cancellation, body: { deviceId: "desktop-1", deviceName: "Mac", clientVersion: "0.1.0" } });
  assert.deepEqual(await api.poll({ ...device, userId: 99, token: "ignored" }, cancellation), { status: "WAITING" });
  assert.deepEqual(calls[1], { method: "POST", path: "/api/app/auth/device/poll", signal: cancellation, body: device });
});

test("profile 直接读取 data 的白名单，logout 接受无 data 的成功响应", async () => {
  const calls = [];
  const profile = {
    ...userInfo, phoneNumber: "13800000000", email: "test@example.test", region: "Shanghai",
    registerTime: "2026-01-01 12:00:00", isBuyout: false, cloudPlanCode: "NONE", localLicenseCode: "NONE",
    expireTime: null, memberExpireTime: null, memberOpenTime: null, cloudPointBalance: 12.34567,
    cloudPointInitialGrant: 20, cloudPointMonthlyGrant: 0, cloudPointMonthlySpend: 7.65433,
    cloudPointMonthlyAvailable: 0, cloudPointTotalGranted: 20, cloudPointTotalSpent: 7.65433, cloudPointMonthKey: "2026-11",
    token: "never-profile-token", userAsset: { coinBalance: 100 }, coinBalance: 100,
    cloudPoint: { balance: 800 }, refreshToken: "discard", quota: { total: 100, remaining: 80 },
  };
  const api = createDesktopAccountApi(async (request) => {
    calls.push(request);
    return ok(request.method === "GET" ? profile : undefined);
  });
  const cancellation = signal();
  const actual = await api.profile(cancellation);
  assert.equal(actual.userId, 42);
  assert.equal(actual.userName, "测试昵称");
  assert.equal(actual.avatarUrl, userInfo.avatarUrl);
  assert.equal(actual.cloudPointBalance, 12.34567);
  assert.equal(actual.cloudPointMonthlyAvailable, 0);
  assert.equal(actual.isBuyout, false);
  assert.equal(actual.memberExpireTime, undefined);
  for (const key of ["token", "refreshToken", "userAsset", "coinBalance", "cloudPoint", "quota"]) {
    assert.equal(Object.hasOwn(actual, key), false);
  }
  assert.deepEqual(calls[0], { method: "GET", path: "/api/app/user/profile", signal: cancellation });
  assert.equal(await api.logout(cancellation), undefined);
  assert.deepEqual(calls[1], { method: "POST", path: "/api/app/auth/logout", signal: cancellation });
});

test("只有 CONFIRMED 且完整登录回执才能交付凭据", async () => {
  const login = { token: "receipt-token", userInfo, isBuyout: true, cloudPlanCode: "PRO", localLicenseCode: "BUYOUT", loginChannel: "DESKTOP_DEVICE", userAsset: { coinBalance: 8 }, currentCompanion: { promptText: "discard" }, refreshToken: "discard" };
  const api = createDesktopAccountApi(async () => ok({ status: "CONFIRMED", login }));
  const result = await api.poll(device, signal());
  assert.deepEqual(result, { status: "CONFIRMED", login: { token: "receipt-token", userInfo, isBuyout: true, cloudPlanCode: "PRO", localLicenseCode: "BUYOUT", loginChannel: "DESKTOP_DEVICE" } });
  for (const status of ["WAITING", "SCANNED", "EXPIRED", "CANCELED", "CONSUMED"]) {
    const waitingApi = createDesktopAccountApi(async () => ok({ status, login }));
    assert.deepEqual(await waitingApi.poll(device, signal()), { status });
  }
  for (const invalidLogin of [undefined, {}, { token: " " }, { token: "receipt-token", userInfo: { userId: 0 } }, { token: "receipt-token", userInfo: { userId: Number.MAX_SAFE_INTEGER + 1 } }]) {
    const invalidApi = createDesktopAccountApi(async () => ok({ status: "CONFIRMED", login: invalidLogin }));
    await assert.rejects(() => invalidApi.poll(device, signal()), DesktopAccountContractError);
  }
});

test("HTTP 200 内的业务 401、403 和 503 都不能当作成功", async () => {
  for (const code of [401, 403, 503]) {
    const api = createDesktopAccountApi(async () => ({ code, msg: "服务暂不可用", data: { ...userInfo, token: "discard" } }));
    for (const call of [() => api.start({}, signal()), () => api.poll(device, signal()), () => api.profile(signal()), () => api.logout(signal())]) {
      await assert.rejects(call, (error) => error instanceof DesktopAccountBusinessError && error.code === code && error.message === "服务暂不可用");
    }
  }
});

test("缺少响应契约、错误嵌套和异常数值不产生登录或假余额", async () => {
  for (const response of [null, [], {}, { code: "200", msg: "ok" }, { code: 200 }, ok({ userInfo }), ok({ userId: "42" }), ok({ userId: 42, cloudPointBalance: "12" }), ok({ userId: 42, cloudPointBalance: -1 }), ok({ userId: 42, cloudPointBalance: Number.NaN }), ok({ userId: 42, isBuyout: "false" })]) {
    const api = createDesktopAccountApi(async () => response);
    await assert.rejects(() => api.profile(signal()), DesktopAccountContractError);
  }
  const emptyProfile = await createDesktopAccountApi(async () => ok({ userId: 42, userName: null, avatarUrl: null })).profile(signal());
  assert.equal(emptyProfile.userName, undefined);
  assert.equal(emptyProfile.avatarUrl, undefined);
  assert.equal(emptyProfile.cloudPointBalance, undefined);
  await assert.rejects(() => createDesktopAccountApi(async () => ok({ status: "AUTHORIZED" })).poll(device, signal()), DesktopAccountContractError);
  for (const change of [{ expireSeconds: 0 }, { pollIntervalMs: -1 }, { qrText: "" }, { sessionId: null }]) {
    await assert.rejects(() => createDesktopAccountApi(async () => ok({ ...startData, ...change })).start({}, signal()), DesktopAccountContractError);
  }
});

test("非法请求和已取消请求不进入 transport", async () => {
  let calls = 0;
  const api = createDesktopAccountApi(async () => { calls += 1; return ok(startData); });
  await assert.rejects(() => api.poll({ sessionId: "", deviceCode: "code" }, signal()), DesktopAccountContractError);
  await assert.rejects(() => api.start({ deviceId: "x".repeat(129) }, signal()), DesktopAccountContractError);
  const canceled = AbortSignal.abort();
  for (const call of [() => api.start({}, canceled), () => api.poll(device, canceled), () => api.profile(canceled), () => api.logout(canceled)]) {
    await assert.rejects(call, { name: "AbortError" });
  }
  assert.equal(calls, 0);
});

test("取消及时拒绝忽略 signal 的 transport，迟到成功不能交付登录凭据", async () => {
  let release;
  let received;
  const api = createDesktopAccountApi((request) => { received = request; return new Promise((resolve) => { release = resolve; }); });
  const controller = new AbortController();
  const pending = api.poll(device, controller.signal);
  await Promise.resolve();
  assert.equal(received.signal, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  release(ok({ status: "CONFIRMED", login: { token: "late-token", userInfo } }));
  await Promise.resolve();
  await assert.rejects(pending, { name: "AbortError" });
});

test("transport 失败原样抛出，后续调用可重新尝试且不遗留登录状态", async () => {
  let calls = 0;
  const failure = new Error("host transport unavailable");
  const api = createDesktopAccountApi(async () => {
    calls += 1;
    if (calls === 1) throw failure;
    return ok({ status: "CONSUMED" });
  });
  await assert.rejects(() => api.poll(device, signal()), (error) => error === failure);
  assert.deepEqual(await api.poll(device, signal()), { status: "CONSUMED" });
  assert.equal(calls, 2);
});

test("响应到达后的取消仍阻止交付已解析的账号数据", async () => {
  const controller = new AbortController();
  const profile = {
    userId: 42,
    get userName() { controller.abort(); return "迟到昵称"; },
  };
  const api = createDesktopAccountApi(async () => ok(profile));
  await assert.rejects(() => api.profile(controller.signal), { name: "AbortError" });
});
