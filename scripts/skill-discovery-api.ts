import type { IncomingMessage, ServerResponse } from "node:http";
import { open, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Connect, Plugin } from "vite";

/**
 * 设置 → 技能 discovery for the browser preview. Mirrors
 * src-tauri/src/skill_discovery.rs: lists direct subfolders holding SKILL.md
 * under ~/.claude/skills, ~/.codex/skills and ~/.agents/skills, and returns
 * the first 4 KB of each SKILL.md. Read-only; JSON POST only, so other sites
 * cannot read the result without a CORS preflight this server never answers.
 */
export function skillDiscoveryApi(): Plugin {
  const middleware = createSkillDiscoveryMiddleware();
  return {
    name: "nekopapa-skill-discovery-api",
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

const ROUTE = "/api/skills/scan";
const SOURCES = [["claude", ".claude/skills"], ["codex", ".codex/skills"], ["agents", ".agents/skills"]] as const;
const MAX_SKILLS = 300;
const MANIFEST_HEAD = 4096;

async function head(path: string): Promise<string | undefined> {
  try {
    const file = await open(path, "r");
    try {
      const buffer = Buffer.alloc(MANIFEST_HEAD);
      const { bytesRead } = await file.read(buffer, 0, MANIFEST_HEAD, 0);
      return buffer.subarray(0, bytesRead).toString("utf8");
    } finally { await file.close(); }
  } catch { return undefined; }
}

export async function scanSkills(home = homedir()) {
  const skills: { source: string; dir: string; manifest: string }[] = [];
  let truncated = false;
  for (const [source, relative] of SOURCES) {
    let names: string[];
    try {
      names = (await readdir(join(home, relative), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    } catch { continue; }
    for (const name of names) {
      const dir = join(home, relative, name);
      const manifest = await head(join(dir, "SKILL.md"));
      if (manifest === undefined) continue;
      if (skills.length >= MAX_SKILLS) { truncated = true; break; }
      skills.push({ source, dir, manifest });
    }
  }
  return { home, skills, truncated };
}

export function createSkillDiscoveryMiddleware(): Connect.NextHandleFunction {
  return (request, response, next) => {
    if ((request.url?.split("?", 1)[0] ?? "") !== ROUTE) { next(); return; }
    void handle(request, response);
  };
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const reply = (status: number, body: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(body));
  };
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); reply(405, { error: "只接受 POST。" }); return; }
  if (!request.headers["content-type"]?.startsWith("application/json")) { reply(415, { error: "需要 JSON。" }); return; }
  try { reply(200, await scanSkills()); } catch { reply(500, { error: "扫描失败。" }); }
}
