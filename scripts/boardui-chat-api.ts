import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { Connect, Plugin } from "vite";

export interface ChatRoute {
  GET: () => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
}

/** Keeps the installed Web API route server-side in Vite dev and preview. */
export function boarduiChatApi(route: ChatRoute): Plugin {
  const middleware = createChatMiddleware(route);
  return {
    name: "nekopapa-boardui-chat-api",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

export function createChatMiddleware(route: ChatRoute): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (request.url?.split("?", 1)[0] !== "/api/chat") { next(); return; }
    void handleChatRequest(request, response, route);
  };
}

async function handleChatRequest(incoming: IncomingMessage, outgoing: ServerResponse, route: ChatRoute): Promise<void> {
  if (incoming.method !== "GET" && incoming.method !== "POST") {
    outgoing.writeHead(405, { Allow: "GET, POST", "Content-Type": "application/json" });
    outgoing.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const cancellation = new AbortController();
  const abort = () => cancellation.abort();
  const onClose = () => { if (!outgoing.writableEnded) abort(); };
  incoming.once("aborted", abort);
  outgoing.once("close", onClose);
  try {
    const result = incoming.method === "GET" ? await route.GET() : await route.POST(toWebRequest(incoming, cancellation.signal));
    if (cancellation.signal.aborted) { await result.body?.cancel(); return; }
    outgoing.statusCode = result.status;
    outgoing.statusMessage = result.statusText;
    result.headers.forEach((value, name) => outgoing.setHeader(name, value));
    if (!result.body) { outgoing.end(); return; }
    outgoing.flushHeaders();
    await pipeline(
      Readable.fromWeb(result.body as unknown as NodeReadableStream<Uint8Array>),
      outgoing,
      { signal: cancellation.signal },
    );
  } catch {
    if (cancellation.signal.aborted || outgoing.destroyed) return;
    if (outgoing.headersSent) { outgoing.destroy(); return; }
    outgoing.writeHead(500, { "Content-Type": "application/json" });
    outgoing.end(JSON.stringify({ error: "chat_runtime_error", message: "The chat runtime could not complete this request." }));
  } finally {
    incoming.off("aborted", abort);
    outgoing.off("close", onClose);
  }
}

function toWebRequest(incoming: IncomingMessage, signal: AbortSignal): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) value.forEach((entry) => headers.append(name, entry));
    else if (value !== undefined) headers.set(name, value);
  }
  return new Request(new URL(incoming.url ?? "/api/chat", "http://127.0.0.1"), {
    method: "POST",
    headers,
    body: Readable.toWeb(incoming) as unknown as ReadableStream<Uint8Array>,
    signal,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}
