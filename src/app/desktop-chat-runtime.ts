import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import type { ChatRuntime } from "./api/chat/runtime";
import { keychainId } from "./chat-model-profile";

/**
 * The chat endpoint in the desktop app. The installed app has no server, so
 * `/api/chat` (and `/api/model-test`) are answered in this window by the same
 * handlers the dev server runs (src/app/api/chat). Their model requests go
 * through the host (src-tauri/src/model_proxy.rs), which fills in API keys
 * from the environment: the window only ever holds stand-ins.
 */

type ModelEvent =
  | { kind: "head"; status: number; headers: [string, string][] }
  | { kind: "chunk"; data: number[] }
  | { kind: "end" }
  | { kind: "error"; message: string };

interface ChatEnvironment { plain: Record<string, string>; keys: Record<string, string>; secrets: string[] }

const stand = (name: string, prefix = "") => `${prefix}{{nekopapa-env:${name}}}`;
let nextId = 1;

/** fetch, through the host: same Request in, a streamed Response out. */
async function hostFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const id = nextId++;
  const body = request.method === "GET" ? undefined : await request.text();
  const headers = [...request.headers.entries()];
  return new Promise<Response>((resolve, reject) => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    let settled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(c) { controller = c; },
      cancel() { void invoke("model_fetch_cancel", { id }); },
    });
    const fail = (error: Error) => {
      if (!settled) { settled = true; reject(error); } else controller?.error(error);
    };
    const events = new Channel<ModelEvent>();
    events.onmessage = (event) => {
      if (event.kind === "head") {
        settled = true;
        resolve(new Response(stream, { status: event.status, headers: event.headers }));
      } else if (event.kind === "chunk") controller?.enqueue(new Uint8Array(event.data));
      else if (event.kind === "end") controller?.close();
      else fail(new Error(event.message));
    };
    request.signal.addEventListener("abort", () => {
      void invoke("model_fetch_cancel", { id });
      fail(new DOMException("The request was aborted.", "AbortError"));
    }, { once: true });
    invoke("model_fetch", { id, request: { url: request.url, method: request.method, headers, body }, events })
      .catch((error: unknown) => fail(new Error(typeof error === "string" ? error : "模型请求失败。")));
  });
}

/** Which variables are set, read fresh for each request so a changed shell environment shows after restart. */
async function desktopRuntime(credentials: string[]): Promise<ChatRuntime> {
  const { PROVIDER_KEY_VARIABLES } = await import("./api/chat/providers");
  const env = await invoke<ChatEnvironment>("chat_environment", { names: [...PROVIDER_KEY_VARIABLES, ...credentials] });
  const key = (name: string) => name in env.keys ? stand(name, env.keys[name]) : undefined;
  // A key typed in settings stays in the keychain; the host fills this stand-in.
  const stored = (name: string) => {
    const id = keychainId(name);
    return id === undefined ? key(name) : env.secrets.includes(id) ? `{{nekopapa-secret:${id}}}` : undefined;
  };
  return { env: (name) => env.plain[name] ?? key(name), credential: stored, desktop: true, fetch: hostFetch };
}

const credentialOf = (body: unknown) => {
  const profile = body && typeof body === "object" ? (body as { profile?: { credential?: unknown } }).profile : undefined;
  return typeof profile?.credential === "string" && profile.credential ? [profile.credential] : [];
};

async function answer(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname;
  const body = request.method === "POST" ? await request.clone().json().catch(() => null) : null;
  const runtime = await desktopRuntime(credentialOf(body));
  if (path === "/api/model-test") {
    const { testModelProfile } = await import("./api/chat/model-test");
    return testModelProfile(request, runtime);
  }
  const { createChatHandlers } = await import("./api/chat/chat-handler");
  const { GET, POST } = createChatHandlers(runtime);
  return request.method === "GET" ? GET() : POST(request);
}

const LOCAL_ROUTES = new Set(["/api/chat", "/api/model-test"]);

/**
 * The fetch chat screens use for `/api/chat`: in the desktop app it answers
 * here; on the dev server it is the ordinary fetch.
 */
export const chatFetch: typeof fetch = async (input, init) => {
  if (!isTauri()) return fetch(input, init);
  const request = new Request(input instanceof URL || typeof input === "string" ? new URL(String(input), location.href) : input, init);
  if (!LOCAL_ROUTES.has(new URL(request.url).pathname)) return fetch(input, init);
  try {
    return await answer(request);
  } catch (error) {
    if (request.signal.aborted) throw error;
    return Response.json({ error: "chat_runtime_error", message: "桌面聊天运行时无法完成这次请求。" }, { status: 500 });
  }
};
