import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Compile the dev-server probe and the shared catalog, then add `.js` to the emitted relative imports.
const output = mkdtempSync(join(tmpdir(), "nekopapa-local-models-"));
let api;
let models;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./local-models-tsconfig.json", import.meta.url)), "--outDir", output]);
  const walk = (dir) => readdirSync(dir).flatMap((name) => statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]);
  for (const file of walk(output).filter((name) => name.endsWith(".js"))) {
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+["'])(\.{1,2}\/[^"']+?)(["'])/g, (_, a, path, b) => `${a}${path.endsWith(".js") ? path : `${path}.js`}${b}`));
  }
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  api = await import(pathToFileURL(join(output, "scripts/local-models-api.js")));
  models = await import(pathToFileURL(join(output, "src/app/models/local-models.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const { LOCAL_RUNTIMES, readLocalRuntime, readLocalProbes, localModelRecord } = models;
const runtime = (id) => LOCAL_RUNTIMES.find((entry) => entry.id === id);
const ok = (body, extra = {}) => ({ port: 1, path: "/", reachable: true, status: 200, body: JSON.stringify(body), ...extra });

test("Ollama's tag list becomes models with size details", () => {
  const state = readLocalRuntime(runtime("ollama"), ok({ models: [
    { name: "llama3.2:3b", size: 2019393189, details: { parameter_size: "3.2B", quantization_level: "Q4_K_M" } },
    { name: "llama3.2:3b" },
    { name: "" },
    { model: "qwen3:8b" },
  ] }));
  assert.deepEqual(state, { kind: "running", models: [
    { id: "llama3.2:3b", detail: "3.2B · Q4_K_M · 2.0 GB" },
    { id: "qwen3:8b" },
  ] });
});

test("OpenAI-compatible servers list their model ids", () => {
  assert.deepEqual(readLocalRuntime(runtime("lmstudio"), ok({ object: "list", data: [{ id: "qwen2.5-7b-instruct" }, { id: 5 }] })),
    { kind: "running", models: [{ id: "qwen2.5-7b-instruct" }] });
  assert.deepEqual(readLocalRuntime(runtime("vllm"), ok({ data: [] })), { kind: "running", models: [] });
});

test("closed ports, errors and foreign services are told apart", () => {
  assert.deepEqual(readLocalRuntime(runtime("ollama"), undefined), { kind: "offline" });
  assert.deepEqual(readLocalRuntime(runtime("ollama"), { port: 11434, path: "/api/tags", reachable: false }), { kind: "offline" });
  assert.match(readLocalRuntime(runtime("llamacpp"), ok({}, { status: 404 })).reason, /HTTP 404/);
  assert.match(readLocalRuntime(runtime("llamacpp"), { port: 8080, path: "/v1/models", reachable: true, status: 200, body: "<html>" }).reason, /可能不是 llama\.cpp/);
  assert.match(readLocalRuntime(runtime("vllm"), ok({ models: [] })).reason, /没有返回模型列表/);
  assert.equal(readLocalRuntime(runtime("jan"), { port: 1337, path: "/v1/models", reachable: true, error: "服务没有及时响应。" }).reason, "服务没有及时响应。");
});

test("host replies are checked before use", () => {
  assert.deepEqual(readLocalProbes("nope"), []);
  assert.deepEqual(readLocalProbes([{ port: 1, path: "/v1/models", reachable: true, status: 200, body: "{}" }, { port: "1" }, null]),
    [{ port: 1, path: "/v1/models", reachable: true, status: 200, body: "{}" }]);
});

test("a local model is saved as a key-less OpenAI-compatible record", () => {
  assert.deepEqual(localModelRecord(runtime("ollama"), "llama3.2:3b"),
    { name: "Ollama · llama3.2:3b", provider: "compatible", endpoint: "http://127.0.0.1:11434/v1", model: "llama3.2:3b", environment: "" });
  assert.equal(localModelRecord(runtime("ollama"), "x".repeat(200)).name.length, 72);
});

test("the dev-server probe reads a real local server and reports a closed port", async (t) => {
  const server = createServer((request, response) => {
    response.writeHead(request.url === "/v1/models" ? 200 : 404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "local-model" }] }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const { port } = server.address();
  const found = await api.probeLocal(port, "/v1/models");
  assert.deepEqual(readLocalRuntime({ ...runtime("lmstudio"), port }, found), { kind: "running", models: [{ id: "local-model" }] });
  const closed = createServer();
  closed.listen(0, "127.0.0.1");
  await once(closed, "listening");
  const closedPort = closed.address().port;
  await new Promise((resolve) => closed.close(resolve));
  assert.deepEqual(await api.probeLocal(closedPort, "/v1/models"), { port: closedPort, path: "/v1/models", reachable: false });
});

test("the dev-server endpoint accepts only JSON POSTs with known paths", async () => {
  const middleware = api.createLocalModelsMiddleware(async () => new Response("{}", { status: 200 }));
  const call = (method, headers, body) => new Promise((resolve) => {
    const chunks = body === undefined ? [] : [body];
    const request = Object.assign((async function* () { yield* chunks; })(), { url: "/api/local-models", method, headers });
    const response = { status: 0, headers: {}, writeHead(status) { this.status = status; }, setHeader(name, value) { this.headers[name] = value; }, end(text) { resolve({ status: this.status, body: JSON.parse(text) }); } };
    middleware(request, response, () => resolve({ status: "next" }));
  });
  assert.equal((await call("GET", {})).status, 405);
  assert.equal((await call("POST", { "content-type": "text/plain" }, "{}")).status, 415);
  assert.equal((await call("POST", { "content-type": "application/json" }, JSON.stringify({ targets: [{ port: 1, path: "/etc/passwd" }] }))).status, 400);
  const accepted = await call("POST", { "content-type": "application/json" }, JSON.stringify({ targets: [{ port: 11434, path: "/api/tags" }] }));
  assert.deepEqual(accepted, { status: 200, body: [{ port: 11434, path: "/api/tags", reachable: true, status: 200, body: "{}" }] });
});
