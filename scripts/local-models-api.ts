import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { LOCAL_PROBE_PATHS, type LocalProbe } from "../src/app/local-models";

/**
 * Local model check for the browser preview (Vite dev and preview servers),
 * which cannot use the desktop host. Mirrors `probe_local_models` in
 * src-tauri/src/local_models.rs: a GET of the listed paths on 127.0.0.1
 * only. JSON POSTs only, so other sites cannot read results without a CORS
 * preflight this server never answers.
 */
export function localModelsApi(): Plugin {
  const middleware = createLocalModelsMiddleware();
  return {
    name: "nekopapa-local-models-api",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

const MAX_TARGETS = 8;
const MAX_BODY = 512 * 1024;

export function createLocalModelsMiddleware(fetcher: typeof fetch = fetch): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (request.url?.split("?", 1)[0] !== "/api/local-models") { next(); return; }
    void handle(request, response, fetcher);
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, fetcher: typeof fetch) {
  const reply = (status: number, body: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(body));
  };
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); reply(405, { error: "method_not_allowed" }); return; }
  if (!request.headers["content-type"]?.startsWith("application/json")) { reply(415, { error: "json_required" }); return; }
  let targets: unknown;
  try {
    let body = "";
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 4096) { reply(413, { error: "too_large" }); return; }
    }
    targets = (JSON.parse(body) as { targets?: unknown }).targets;
  } catch {
    reply(400, { error: "invalid_json" });
    return;
  }
  const valid = Array.isArray(targets) && targets.length <= MAX_TARGETS && targets.every((target) =>
    target && typeof target === "object" && Number.isInteger(target.port) && target.port > 0 && target.port < 65536
    && (LOCAL_PROBE_PATHS as readonly string[]).includes(target.path));
  if (!valid) { reply(400, { error: "invalid_targets" }); return; }
  reply(200, await Promise.all((targets as { port: number; path: string }[]).map((target) => probeLocal(target.port, target.path, fetcher))));
}

export async function probeLocal(port: number, path: string, fetcher: typeof fetch = fetch): Promise<LocalProbe> {
  try {
    const reply = await fetcher(`http://127.0.0.1:${port}${path}`, { headers: { Accept: "application/json" }, redirect: "manual", signal: AbortSignal.timeout(2500) });
    const body = await reply.text();
    if (body.length > MAX_BODY) return { port, path, reachable: true, error: "模型列表过大。" };
    return { port, path, reachable: true, status: reply.status, body };
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "ECONNREFUSED" || code === "EADDRNOTAVAIL") return { port, path, reachable: false };
    const timedOut = (error as Error).name === "TimeoutError";
    return timedOut ? { port, path, reachable: true, error: "服务没有及时响应。" } : { port, path, reachable: false };
  }
}
