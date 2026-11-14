import { createServer } from "node:http";
import { once } from "node:events";

/**
 * A stand-in OpenAI-compatible model for chat-handler tests.
 * `reply(body, index)` returns { tool: { name, input } } or { text }, and
 * optionally `usage: { prompt, completion }` to report for that call.
 * Returns a saved model profile pointing at it and every request body seen.
 */
export async function standInModel(t, reply) {
  const seen = [];
  const server = createServer(async (incoming, response) => {
    let raw = "";
    for await (const chunk of incoming) raw += chunk;
    const body = JSON.parse(raw);
    seen.push(body);
    const answer = await reply(body, seen.length - 1);
    const usage = answer.usage ? { prompt_tokens: answer.usage.prompt, completion_tokens: answer.usage.completion, total_tokens: answer.usage.prompt + answer.usage.completion } : undefined;
    // generateText (the summary) asks without streaming.
    if (!body.stream) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: `c${seen.length}`, object: "chat.completion", created: 0, model: "m", choices: [{ index: 0, message: { role: "assistant", content: answer.text ?? "" }, finish_reason: "stop" }], usage: usage ?? { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream" });
    const chunk = (delta, finish = null) => `data: ${JSON.stringify({ id: `c${seen.length}`, object: "chat.completion.chunk", created: 0, model: "m", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
    if (answer.tool) {
      response.write(chunk({ role: "assistant", tool_calls: [{ index: 0, id: `call_${seen.length}`, type: "function", function: { name: answer.tool.name, arguments: JSON.stringify(answer.tool.input) } }] }));
      response.write(chunk({}, "tool_calls"));
    } else {
      response.write(chunk({ role: "assistant", content: answer.text }));
      response.write(chunk({}, "stop"));
    }
    if (usage) response.write(`data: ${JSON.stringify({ id: `c${seen.length}`, object: "chat.completion.chunk", created: 0, model: "m", choices: [], usage })}\n\n`);
    response.end("data: [DONE]\n\n");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  return { profile: { provider: "compatible", endpoint: `http://127.0.0.1:${server.address().port}/v1`, model: "m", credential: "" }, seen };
}
