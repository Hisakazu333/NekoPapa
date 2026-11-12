import type { DiffLine } from "./project-workspace";

/**
 * What a project file is, from its name alone: the Shiki language that
 * highlights it in 文件 / 更改 / the Agent's change cards, and the kind of
 * icon the file tree shows. Unknown names are plain text with a file icon.
 */

const BY_EXTENSION: Record<string, string> = {
  ts: "typescript", mts: "typescript", cts: "typescript", tsx: "tsx", js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "jsx",
  json: "json", jsonc: "jsonc", json5: "json5", css: "css", scss: "scss", sass: "sass", less: "less", html: "html", htm: "html", vue: "vue", svelte: "svelte",
  md: "markdown", mdx: "mdx", rs: "rust", py: "python", go: "go", java: "java", kt: "kotlin", kts: "kotlin", swift: "swift",
  c: "c", h: "c", cc: "cpp", cpp: "cpp", hpp: "cpp", cs: "csharp", rb: "ruby", php: "php", sh: "bash", bash: "bash", zsh: "bash",
  fish: "fish", ps1: "powershell", sql: "sql", yml: "yaml", yaml: "yaml", toml: "toml", xml: "xml", svg: "xml", plist: "xml",
  graphql: "graphql", gql: "graphql", lua: "lua", dart: "dart", scala: "scala", r: "r", ini: "ini", proto: "proto", tf: "hcl",
};
const BY_NAME: Record<string, string> = {
  dockerfile: "docker", makefile: "makefile", ".gitignore": "ini", ".npmrc": "ini", ".editorconfig": "ini", ".env": "dotenv", "cargo.lock": "toml",
};

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1).toLowerCase();
const extension = (name: string) => { const dot = name.lastIndexOf("."); return dot > 0 ? name.slice(dot + 1) : ""; };

/** The highlighter language for a path, or "" for plain text. */
export function languageForPath(path: string): string {
  const name = baseName(path);
  if (BY_NAME[name]) return BY_NAME[name];
  if (name.startsWith(".env")) return "dotenv";
  return BY_EXTENSION[extension(name)] ?? "";
}

export type FileKind = "code" | "data" | "config" | "text" | "image" | "audio" | "video" | "archive" | "lock" | "file";

const KINDS: Record<string, FileKind> = {
  json: "data", jsonc: "data", json5: "data", yml: "data", yaml: "data", toml: "data", xml: "data", csv: "data", tsv: "data", plist: "data",
  md: "text", mdx: "text", txt: "text", rst: "text", pdf: "text",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", ico: "image", icns: "image", bmp: "image", avif: "image", svg: "image",
  mp3: "audio", wav: "audio", ogg: "audio", flac: "audio", m4a: "audio", mp4: "video", mov: "video", webm: "video", mkv: "video",
  zip: "archive", gz: "archive", tgz: "archive", tar: "archive", "7z": "archive", rar: "archive", dmg: "archive",
  lock: "lock", pem: "lock", key: "lock",
  ini: "config", env: "config", conf: "config", cfg: "config",
};

/** Which icon a file gets in the tree. */
export function fileKind(path: string): FileKind {
  const name = baseName(path);
  if (name.endsWith("-lock.json") || name.endsWith(".lock") || name === "pnpm-lock.yaml") return "lock";
  if (name.startsWith(".") || name.startsWith("dockerfile") || name === "makefile") return "config";
  const kind = KINDS[extension(name)];
  if (kind) return kind;
  return BY_EXTENSION[extension(name)] ? "code" : "file";
}

/**
 * The two sides of a diff as whole texts, so each can be highlighted with
 * its surrounding lines (a line inside a comment or template string colors
 * as such), and where each diff line sits in them: `old[i]` / `new[i]` is
 * the row of diff line i in that side, or -1 when the line is not on it.
 */
export interface DiffSides { oldText: string; newText: string; old: number[]; new: number[] }

export function diffSides(lines: readonly DiffLine[]): DiffSides {
  const oldLines: string[] = [];
  const newLines: string[] = [];
  const old: number[] = [];
  const next: number[] = [];
  for (const line of lines) {
    const onOld = line.kind === "ctx" || line.kind === "del";
    const onNew = line.kind === "ctx" || line.kind === "add";
    old.push(onOld ? oldLines.push(line.text) - 1 : -1);
    next.push(onNew ? newLines.push(line.text) - 1 : -1);
  }
  return { oldText: oldLines.join("\n"), newText: newLines.join("\n"), old, new: next };
}
