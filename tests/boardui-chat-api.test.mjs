import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Compile the production bridge without leaving emitted JavaScript beside source files.
const output = mkdtempSync(join(tmpdir(), "nekopapa-boardui-api-"));
let createChatMiddleware;
try {
  const config = fileURLToPath(new URL("./boardui-api-tsconfig.json", import.meta.url));
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", config, "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  ({ createChatMiddleware } = await import(pathToFileURL(join(output, "boardui-chat-api.js"))));
} finally { rmSync(output, { recursive: true, force: true }); }

async function serve(t, route) {
  const middleware = createChatMiddleware(route);
  const server = createServer((request, response) => middleware(request, response, () => {
    response.writeHead(404);
    response.end("Not handled");
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}`;
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function within(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Timed out waiting for stream cancellation")), 2000);
    })]);
  } finally { clearTimeout(timer); }
}

test("chat probe preserves the official JSON response and query path", async (t) => {
  const probe = { configured: false, provider: null, model: null, reason: "No provider configured", contract: 1 };
  const base = await serve(t, {
    GET: async () => Response.json(probe),
    POST: async () => { throw new Error("POST should not run"); },
  });
  const response = await fetch(`${base}/api/chat?probe=1`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await response.json(), probe);
});

test("POST forwards the JSON body and headers and keeps runtime error status", async (t) => {
  const messages = [{ id: "user-1", role: "user", parts: [{ type: "text", text: "你好\n第二行" }] }];
  const base = await serve(t, {
    GET: async () => Response.json({ configured: false }),
    POST: async (request) => {
      assert.equal(request.method, "POST");
      assert.equal(new URL(request.url).searchParams.get("test"), "yes");
      assert.equal(request.headers.get("x-test-request"), "present");
      assert.deepEqual(await request.json(), { messages });
      return Response.json({ error: "missing_api_key" }, { status: 503, headers: { "x-runtime-contract": "1" } });
    },
  });
  const response = await fetch(`${base}/api/chat?test=yes`, {
    method: "POST", headers: { "content-type": "application/json", "x-test-request": "present" }, body: JSON.stringify({ messages }),
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("x-runtime-contract"), "1");
  assert.deepEqual(await response.json(), { error: "missing_api_key" });
});

test("UI-message streams reach the client before generation completes", async (t) => {
  const encoder = new TextEncoder();
  let finish;
  const first = 'data: {"type":"text-start","id":"reply"}\n\n';
  const last = "data: [DONE]\n\n";
  const base = await serve(t, {
    GET: async () => Response.json({ configured: false }),
    POST: async (request) => {
      await request.json();
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(first));
          finish = () => { controller.enqueue(encoder.encode(last)); controller.close(); };
        },
      }), { headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" } });
    },
  });
  const response = await fetch(`${base}/api/chat`, { method: "POST", body: "{}" });
  assert.equal(response.headers.get("x-vercel-ai-ui-message-stream"), "v1");
  const reader = response.body.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value), first);
  finish();
  assert.equal(new TextDecoder().decode((await reader.read()).value), last);
  assert.equal((await reader.read()).done, true);
});

test("stopping a client stream aborts the runtime request and cancels the source", async (t) => {
  const aborted = deferred();
  const cancelled = deferred();
  const base = await serve(t, {
    GET: async () => Response.json({ configured: false }),
    POST: async (request) => {
      await request.json();
      request.signal.addEventListener("abort", aborted.resolve, { once: true });
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode("data: started\n\n")); },
        cancel() { cancelled.resolve(); },
      }), { headers: { "content-type": "text/event-stream" } });
    },
  });
  const controller = new AbortController();
  const response = await fetch(`${base}/api/chat`, { method: "POST", body: "{}", signal: controller.signal });
  await response.body.getReader().read();
  controller.abort();
  await within(Promise.all([aborted.promise, cancelled.promise]));
});

test("other paths fall through and unsupported methods cannot call the runtime", async (t) => {
  const unexpected = async () => { throw new Error("The runtime must not be called"); };
  const base = await serve(t, { GET: unexpected, POST: unexpected });
  assert.equal((await fetch(`${base}/api/chat-extra`)).status, 404);
  const response = await fetch(`${base}/api/chat`, { method: "DELETE" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, POST");
  assert.deepEqual(await response.json(), { error: "method_not_allowed" });
});

test("unexpected runtime failures return a bounded error without exception details", async (t) => {
  const base = await serve(t, {
    GET: async () => { throw new Error("private runtime detail"); },
    POST: async () => Response.json({}),
  });
  const response = await fetch(`${base}/api/chat`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "chat_runtime_error", message: "The chat runtime could not complete this request.",
  });
});
