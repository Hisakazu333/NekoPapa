import {
  desktopAccountSessionBody,
  desktopAccountStartBody,
  parseDesktopAccountDevicePoll,
  parseDesktopAccountDeviceStart,
  parseDesktopAccountProfile,
  parseDesktopAccountResponse,
  type DesktopAccountDevicePoll,
  type DesktopAccountDeviceSessionRequest,
  type DesktopAccountDeviceStart,
  type DesktopAccountDeviceStartRequest,
  type DesktopAccountProfile,
} from "./desktop-account-contract";

export type DesktopAccountAvailability = Readonly<
  | { kind: "disabled"; reason: "backend-restructuring" }
  | { kind: "available" }
>;

export type DesktopAccountEndpoint =
  | "/api/app/auth/device/start"
  | "/api/app/auth/device/poll"
  | "/api/app/user/profile"
  | "/api/app/auth/logout";

export interface DesktopAccountRequest {
  readonly method: "GET" | "POST";
  readonly path: DesktopAccountEndpoint;
  readonly body?: Readonly<Record<string, string>>;
  readonly signal: AbortSignal;
}

/** The future host transport owns HTTP, metadata and credentials. No default fetch. */
export type DesktopAccountTransport = (request: DesktopAccountRequest) => Promise<unknown>;

export interface DesktopAccountApi {
  readonly availability: DesktopAccountAvailability;
  start(input: DesktopAccountDeviceStartRequest, signal: AbortSignal): Promise<DesktopAccountDeviceStart>;
  poll(input: DesktopAccountDeviceSessionRequest, signal: AbortSignal): Promise<DesktopAccountDevicePoll>;
  profile(signal: AbortSignal): Promise<DesktopAccountProfile>;
  logout(signal: AbortSignal): Promise<void>;
}

export class DesktopAccountUnavailableError extends Error {
  readonly reason = "backend-restructuring";

  constructor() {
    super("账号后端正在重构，尚未启用连接。");
    this.name = "DesktopAccountUnavailableError";
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("账号请求已取消。", "AbortError");
}

/** Reject promptly even if a host transport ignores cancellation or finishes late. */
function exchange(transport: DesktopAccountTransport, request: DesktopAccountRequest): Promise<unknown> {
  const { signal } = request;
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new DOMException("账号请求已取消。", "AbortError"));
    signal.addEventListener("abort", cancel, { once: true });
    Promise.resolve().then(() => {
      throwIfAborted(signal);
      return transport(request);
    }).then((response) => {
      throwIfAborted(signal);
      resolve(response);
    }).catch(reject).finally(() => {
      signal.removeEventListener("abort", cancel);
    });
  });
}

export function createDesktopAccountApi(transport?: DesktopAccountTransport): DesktopAccountApi {
  const availability: DesktopAccountAvailability = Object.freeze(transport
    ? { kind: "available" }
    : { kind: "disabled", reason: "backend-restructuring" });

  const request = async (
    method: DesktopAccountRequest["method"],
    path: DesktopAccountEndpoint,
    signal: AbortSignal,
    body?: () => Record<string, string>,
  ): Promise<unknown> => {
    if (!transport) throw new DesktopAccountUnavailableError();
    throwIfAborted(signal);
    const response = await exchange(transport, { method, path, signal, ...(body ? { body: body() } : {}) });
    throwIfAborted(signal);
    const data = parseDesktopAccountResponse(response);
    throwIfAborted(signal);
    return data;
  };

  return Object.freeze({
    availability,
    async start(input: DesktopAccountDeviceStartRequest, signal: AbortSignal) {
      const result = parseDesktopAccountDeviceStart(await request(
        "POST", "/api/app/auth/device/start", signal, () => desktopAccountStartBody(input),
      ));
      throwIfAborted(signal);
      return result;
    },
    async poll(input: DesktopAccountDeviceSessionRequest, signal: AbortSignal) {
      const result = parseDesktopAccountDevicePoll(await request(
        "POST", "/api/app/auth/device/poll", signal, () => desktopAccountSessionBody(input),
      ));
      throwIfAborted(signal);
      return result;
    },
    async profile(signal: AbortSignal) {
      const result = parseDesktopAccountProfile(await request("GET", "/api/app/user/profile", signal));
      throwIfAborted(signal);
      return result;
    },
    async logout(signal: AbortSignal) {
      await request("POST", "/api/app/auth/logout", signal);
      throwIfAborted(signal);
    },
  });
}

/** Deliberately offline until the backend and native credential transport are ready. */
export const desktopAccountApi = createDesktopAccountApi();
