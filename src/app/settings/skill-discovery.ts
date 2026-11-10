/**
 * Skill folders found on this computer (see src-tauri/src/skill_discovery.rs
 * and scripts/skill-discovery-api.ts), turned into rows for 设置 → 技能: the
 * name and description from SKILL.md's front matter, where it came from, and
 * whether a saved skill already points at it.
 */

export type SkillSource = "claude" | "codex" | "agents";
export const SKILL_SOURCE_LABELS: Record<SkillSource, string> = {
  claude: "Claude Code",
  codex: "Codex",
  agents: "Agent Skills",
};
export const SKILL_SOURCE_ROOTS: Record<SkillSource, string> = {
  claude: "~/.claude/skills",
  codex: "~/.codex/skills",
  agents: "~/.agents/skills",
};

export interface SkillScan { home: string; skills: { source: SkillSource; dir: string; manifest: string }[]; truncated: boolean }
export interface FoundSkill { source: SkillSource; dir: string; name: string; description: string }

const isSource = (value: unknown): value is SkillSource => value === "claude" || value === "codex" || value === "agents";

export function readSkillScan(value: unknown): SkillScan {
  const input = value as Partial<SkillScan> | null;
  if (!input || typeof input.home !== "string" || !Array.isArray(input.skills)) throw new Error("扫描结果无效。");
  return {
    home: input.home,
    truncated: input.truncated === true,
    skills: input.skills.filter((skill) => skill && isSource(skill.source) && typeof skill.dir === "string" && typeof skill.manifest === "string"),
  };
}

const unquote = (value: string) => value.trim().replace(/^(['"])(.*)\1$/, "$2").trim();

/** `name` and `description` from a leading `---` YAML block (single-line values, or a folded `>` / `|` block). */
export function parseSkillManifest(text: string): { name?: string; description?: string } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return {};
  const result: Record<string, string> = {};
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "---") break;
    const match = /^(name|description):\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if (/^[>|][-+]?\s*$/.test(value)) {
      const block: string[] = [];
      while (index + 1 < lines.length && /^\s+\S/.test(lines[index + 1])) block.push(lines[++index].trim());
      value = block.join(" ");
    }
    result[match[1]] = unquote(value);
  }
  return { name: result.name || undefined, description: result.description || undefined };
}

const folderName = (dir: string) => dir.split(/[\\/]/).filter(Boolean).pop() ?? dir;

/** Expands a leading `~` and drops trailing separators, so saved paths compare with found ones. */
export function normalizeSkillPath(path: string, home: string): string {
  const trimmed = path.trim();
  const expanded = trimmed === "~" ? home : /^~[\\/]/.test(trimmed) ? home.replace(/[\\/]+$/, "") + trimmed.slice(1) : trimmed;
  return expanded.replace(/[\\/]+$/, "");
}

/** Shows a path under the home folder as `~/…`. */
export const displaySkillPath = (dir: string, home: string) => {
  const base = home.replace(/[\\/]+$/, "");
  return base && dir.startsWith(base + "/") ? `~${dir.slice(base.length)}` : dir;
};

export function foundSkills(scan: SkillScan): FoundSkill[] {
  return scan.skills.map((skill) => {
    const manifest = parseSkillManifest(skill.manifest);
    return { source: skill.source, dir: skill.dir, name: manifest.name ?? folderName(skill.dir), description: manifest.description ?? "" };
  });
}

/** The found skills whose folder is already saved, by normalized path. */
export function savedSkillDirs(savedPaths: readonly string[], home: string): Set<string> {
  return new Set(savedPaths.map((path) => normalizeSkillPath(path, home)));
}
