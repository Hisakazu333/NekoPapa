/** Java desktop account DTOs. Credentials are receipts, never configuration data. */
export class DesktopAccountContractError extends Error {
  constructor(field: string) {
    super(`账号服务响应格式无效：${field}`);
    this.name = "DesktopAccountContractError";
  }
}

export class DesktopAccountBusinessError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "DesktopAccountBusinessError";
    this.code = code;
  }
}

export interface DesktopAccountDeviceStartRequest {
  deviceId?: string;
  deviceName?: string;
  clientVersion?: string;
}

export interface DesktopAccountDeviceSessionRequest {
  sessionId: string;
  deviceCode: string;
}

export interface DesktopAccountDeviceStart extends DesktopAccountDeviceSessionRequest {
  qrText: string;
  expireSeconds: number;
  pollIntervalMs: number;
}

export interface DesktopAccountUserInfo {
  userId: number;
  userName?: string;
  avatarUrl?: string;
  nekoId?: string;
  createTime?: string;
}

export interface DesktopAccountProfile extends DesktopAccountUserInfo {
  phoneNumber?: string;
  email?: string;
  region?: string;
  registerTime?: string;
  isBuyout?: boolean;
  cloudPlanCode?: string;
  localLicenseCode?: string;
  expireTime?: string;
  memberExpireTime?: string;
  memberOpenTime?: string;
  cloudPointBalance?: number;
  cloudPointInitialGrant?: number;
  cloudPointMonthlyGrant?: number;
  cloudPointMonthlySpend?: number;
  cloudPointMonthlyAvailable?: number;
  cloudPointTotalGranted?: number;
  cloudPointTotalSpent?: number;
  cloudPointMonthKey?: string;
}

export interface DesktopAccountLoginReceipt {
  token: string;
  userInfo: DesktopAccountUserInfo;
  isBuyout?: boolean;
  cloudPlanCode?: string;
  localLicenseCode?: string;
  loginChannel?: string;
}

export type DesktopAccountDeviceStatus =
  | "WAITING" | "SCANNED" | "CONFIRMED" | "EXPIRED" | "CANCELED" | "CONSUMED";

export type DesktopAccountDevicePoll =
  | { status: "CONFIRMED"; login: DesktopAccountLoginReceipt }
  | { status: Exclude<DesktopAccountDeviceStatus, "CONFIRMED">; login?: never };

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DesktopAccountContractError(field);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new DesktopAccountContractError(field);
  return value;
}

function optionalText(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (value === undefined || value === null) return;
  if (typeof value !== "string") throw new DesktopAccountContractError(key);
  return value || undefined;
}

function optionalNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  if (value === undefined || value === null) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new DesktopAccountContractError(key);
  }
  return value;
}

function optionalBoolean(source: Record<string, unknown>, key: string): boolean | undefined {
  const value = source[key];
  if (value === undefined || value === null) return;
  if (typeof value !== "boolean") throw new DesktopAccountContractError(key);
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new DesktopAccountContractError(field);
  }
  return value;
}

/** HTTP success alone is insufficient: Java reports authorization in code. */
export function parseDesktopAccountResponse(value: unknown): unknown {
  const response = object(value, "response");
  if (typeof response.code !== "number" || !Number.isInteger(response.code)
    || typeof response.msg !== "string") throw new DesktopAccountContractError("code/msg");
  if (response.code !== 200) {
    throw new DesktopAccountBusinessError(response.code, response.msg || "账号服务请求失败");
  }
  return response.data;
}

export function desktopAccountStartBody(input: DesktopAccountDeviceStartRequest): Record<string, string> {
  const source = object(input, "device");
  const result: Record<string, string> = {};
  for (const [key, limit] of [["deviceId", 128], ["deviceName", 100], ["clientVersion", 50]] as const) {
    const value = optionalText(source, key);
    if (value === undefined) continue;
    if (value.length > limit) throw new DesktopAccountContractError(key);
    result[key] = value;
  }
  return result;
}

export function desktopAccountSessionBody(input: DesktopAccountDeviceSessionRequest): Record<string, string> {
  const source = object(input, "deviceSession");
  return { sessionId: text(source.sessionId, "sessionId"), deviceCode: text(source.deviceCode, "deviceCode") };
}

export function parseDesktopAccountDeviceStart(value: unknown): DesktopAccountDeviceStart {
  const source = object(value, "deviceSession");
  return {
    sessionId: text(source.sessionId, "sessionId"),
    deviceCode: text(source.deviceCode, "deviceCode"),
    qrText: text(source.qrText, "qrText"),
    expireSeconds: positiveInteger(source.expireSeconds, "expireSeconds"),
    pollIntervalMs: positiveInteger(source.pollIntervalMs, "pollIntervalMs"),
  };
}

function parseUserInfo(value: unknown): DesktopAccountUserInfo {
  const source = object(value, "userInfo");
  return {
    userId: positiveInteger(source.userId, "userId"),
    userName: optionalText(source, "userName"),
    avatarUrl: optionalText(source, "avatarUrl"),
    nekoId: optionalText(source, "nekoId"),
    createTime: optionalText(source, "createTime"),
  };
}

function parseLoginReceipt(value: unknown): DesktopAccountLoginReceipt {
  const source = object(value, "login");
  return {
    token: text(source.token, "login.token"),
    userInfo: parseUserInfo(source.userInfo),
    isBuyout: optionalBoolean(source, "isBuyout"),
    cloudPlanCode: optionalText(source, "cloudPlanCode"),
    localLicenseCode: optionalText(source, "localLicenseCode"),
    loginChannel: optionalText(source, "loginChannel"),
  };
}

export function parseDesktopAccountDevicePoll(value: unknown): DesktopAccountDevicePoll {
  const source = object(value, "devicePoll");
  const status = source.status;
  if (status === "CONFIRMED") return { status, login: parseLoginReceipt(source.login) };
  if (status === "WAITING" || status === "SCANNED" || status === "EXPIRED"
    || status === "CANCELED" || status === "CONSUMED") return { status };
  throw new DesktopAccountContractError("status");
}

/** Profile data is flat; userAsset and nested cloudPoint are not quota data. */
export function parseDesktopAccountProfile(value: unknown): DesktopAccountProfile {
  const source = object(value, "profile");
  return {
    ...parseUserInfo(source),
    phoneNumber: optionalText(source, "phoneNumber"),
    email: optionalText(source, "email"),
    region: optionalText(source, "region"),
    registerTime: optionalText(source, "registerTime"),
    isBuyout: optionalBoolean(source, "isBuyout"),
    cloudPlanCode: optionalText(source, "cloudPlanCode"),
    localLicenseCode: optionalText(source, "localLicenseCode"),
    expireTime: optionalText(source, "expireTime"),
    memberExpireTime: optionalText(source, "memberExpireTime"),
    memberOpenTime: optionalText(source, "memberOpenTime"),
    cloudPointBalance: optionalNumber(source, "cloudPointBalance"),
    cloudPointInitialGrant: optionalNumber(source, "cloudPointInitialGrant"),
    cloudPointMonthlyGrant: optionalNumber(source, "cloudPointMonthlyGrant"),
    cloudPointMonthlySpend: optionalNumber(source, "cloudPointMonthlySpend"),
    cloudPointMonthlyAvailable: optionalNumber(source, "cloudPointMonthlyAvailable"),
    cloudPointTotalGranted: optionalNumber(source, "cloudPointTotalGranted"),
    cloudPointTotalSpent: optionalNumber(source, "cloudPointTotalSpent"),
    cloudPointMonthKey: optionalText(source, "cloudPointMonthKey"),
  };
}
