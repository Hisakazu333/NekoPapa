import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([
  ".git",
  "build",
  "dist",
  "node_modules",
  "target",
]);
const markdownFiles = [];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(path);
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      markdownFiles.push(path);
    }
  }
}

function normalizeTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1);
  }
  target = target.replace(/[?#].*$/, "");
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function isExternal(target) {
  return (
    target.length === 0
    || target.startsWith("#")
    || target.startsWith("/")
    || /^[a-z][a-z0-9+.-]*:/i.test(target)
  );
}

collect(repoRoot);

const failures = [];
const markdownLink = /!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+["'][^)]*["'])?\)/g;
const htmlLink = /\b(?:href|src)=["']([^"']+)["']/gi;

for (const file of markdownFiles) {
  const content = readFileSync(file, "utf8");
  const targets = [];
  for (const pattern of [markdownLink, htmlLink]) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      targets.push(match[1]);
    }
  }

  for (const rawTarget of targets) {
    if (isExternal(rawTarget)) {
      continue;
    }
    const target = normalizeTarget(rawTarget);
    if (isExternal(target)) {
      continue;
    }
    const resolved = resolve(dirname(file), target);
    if (!existsSync(resolved)) {
      failures.push(`${relative(repoRoot, file)} -> ${rawTarget}`);
      continue;
    }
    statSync(resolved);
  }
}

if (failures.length > 0) {
  console.error("Broken local documentation links:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Documentation links OK (${markdownFiles.length} Markdown files checked).`);
