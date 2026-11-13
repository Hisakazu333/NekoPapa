import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Browser annotations travel as their own message part and reach the model
// as compact text; chats are told what they can and cannot see, so a
// question about the user's code is not answered by guessing.
const output = mkdtempSync(join(tmpdir(), "nekopapa-page-annotations-"));
let handler, part;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./agent-tools-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  symlinkSync(fileURLToPath(new URL("../node_modules", import.meta.url)), join(output, "node_modules"), "dir");
  for (const name of readdirSync(output, { recursive: true })) {
    const file = join(output, String(name));
    if (file.includes("node_modules") || !file.endsWith(".js")) continue;
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`));
  }
  const load = (path) => import(pathToFileURL(join(output, path)));
  [handler, part] = await Promise.all([load("app/api/chat/chat-handler.js"), load("app/browser/page-element-part.js")]);
} finally { rmSync(output, { recursive: true, force: true }); }

const element = {
  id: "e1", url: "http://localhost:1495/", title: "NekoPapa", selector: "header > button:nth-of-type(1)", tag: "button",
  text: "", html: `<button aria-label="目录" class="size-7 rounded-md">${"<svg></svg>".repeat(400)}</button>`, htmlTruncated: false,
  size: { width: 28, height: 28 }, styles: { color: "oklch(0.985 0 none)", "font-size": "16px" }, comment: "看得到这里的代码吗？", changes: {},
};

test("annotations become one data part without computed styles and with the HTML cut short", () => {
  assert.equal(part.pageElementsPart([]), undefined);
  const built = part.pageElementsPart([element]);
  assert.equal(built.type, "data-page-elements");
  const [note] = built.data.elements;
  assert.equal("styles" in note, false);
  assert.equal("id" in note, false);
  assert.equal(note.html.length, 1500);
  assert.equal(note.htmlTruncated, true);
  assert.deepEqual(part.readPageElementsPart(built), built.data.elements);
});

test("a saved or posted part is checked again; other parts are not annotations", () => {
  assert.equal(part.readPageElementsPart({ type: "text", text: "hi" }), undefined);
  assert.equal(part.readPageElementsPart({ type: "data-page-elements", data: { elements: [{ ...element, url: "file:///etc/hosts" }] } }), undefined);
  assert.equal(part.readPageElementsPart({ type: "data-page-elements", data: { elements: [{ ...element, tag: "<script>" }] } }), undefined);
  const many = part.readPageElementsPart({ type: "data-page-elements", data: { elements: Array(9).fill(element) } });
  assert.equal(many.length, 5);
});

test("the model reads each annotation as numbered compact text", () => {
  const text = part.pageElementsPrompt(part.pageElementsPart([element, { ...element, comment: "" }]).data.elements);
  assert.match(text, /^\[网页标注 1\/2\]\n批注：看得到这里的代码吗？\n网页元素：NekoPapa（http:\/\/localhost:1495\/）\n选择器：header > button:nth-of-type\(1\)/);
  assert.match(text, /\[网页标注 2\/2\]\n网页元素：/);
  assert.match(text, /HTML（前 1500 个字符）：\n```html\n<button aria-label="目录"/);
  assert.doesNotMatch(text, /oklch|font-size/);
});

async function recordingModel(t) {
  const seen = [];
  const server = createServer(async (incoming, response) => {
    let raw = "";
    for await (const chunk of incoming) raw += chunk;
    seen.push(JSON.parse(raw));
    response.writeHead(200, { "content-type": "text/event-stream" });
    const chunk = (delta, finish = null) => `data: ${JSON.stringify({ id: "c1", object: "chat.completion.chunk", created: 0, model: "m", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
    response.write(chunk({ role: "assistant", content: "好" }));
    response.write(chunk({}, "stop"));
    response.end("data: [DONE]\n\n");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  return { profile: { provider: "compatible", endpoint: `http://127.0.0.1:${server.address().port}/v1`, model: "m", credential: "" }, seen };
}
const post = (body) => new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const runtime = { env: () => undefined, credential: () => undefined, desktop: true, agent: {} };
const annotated = [{ id: "u1", role: "user", parts: [{ type: "text", text: "这个按钮在哪个文件？" }, part.pageElementsPart([element])] }];

test("an annotated message reaches the model as the typed text plus the annotation, in a chat without a project", async (t) => {
  const { profile, seen } = await recordingModel(t);
  const { POST } = handler.createChatHandlers(runtime);
  const response = await POST(post({ messages: annotated, profile }));
  assert.equal(response.status, 200);
  await response.text();
  const [system, user] = seen[0].messages;
  const content = JSON.stringify(user.content);
  assert.match(content, /这个按钮在哪个文件？/);
  assert.match(content, /\[网页标注 1\/1\]/);
  assert.match(content, /aria-label=\\"目录\\"/);
  assert.match(system.content, /No project folder is chosen/);
  assert.match(system.content, /Never guess file paths/);
  assert.equal(seen[0].tools, undefined);
});

test("a project chat is told to find an annotated element in the source before naming a file", async (t) => {
  const { profile, seen } = await recordingModel(t);
  const { POST } = handler.createChatHandlers(runtime);
  await (await POST(post({ messages: annotated, profile, workspace: { root: "/projects/demo", name: "demo", permission: "plan" } }))).text();
  const system = seen[0].messages[0].content;
  assert.match(system, /web annotations/);
  assert.match(system, /search the project for its visible text, aria-label/);
  assert.doesNotMatch(system, /No project folder/);
});
