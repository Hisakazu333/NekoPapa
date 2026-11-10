import { useCallback, useEffect, useState } from "react";
import { CheckIcon, RefreshCwIcon } from "@/components/foundations/icons/app-icons";
import { collectionSchemas, fieldDefaults } from "@/app/settings/configuration-contract";
import { displaySkillPath, foundSkills, savedSkillDirs, SKILL_SOURCE_LABELS, SKILL_SOURCE_ROOTS, type FoundSkill } from "@/app/settings/skill-discovery";
import { scanSkillFolders } from "@/app/settings/skill-discovery-client";
import { Button } from "@/components/base/buttons/button";
import { useConfiguration } from "@/hooks/use-configuration";
import { SettingsCard, SettingsSectionLabel } from "./settings-rows";

type Scan = { kind: "scanning" } | { kind: "error"; message: string } | { kind: "ready"; home: string; skills: FoundSkill[]; truncated: boolean };
const LIMIT = 100;

/**
 * 在本机发现: opening 技能 scans the per-user skill folders of Claude Code,
 * Codex and Agent Skills and lists what is there; nothing is saved until the
 * user adds a skill (one, or all not yet added). Added skills are ordinary
 * 技能目录 records and can be edited or removed like any other.
 */
export function SkillDiscoverySection({ onStatus }: { onStatus: (message: string, error?: boolean) => void }) {
  const { store, data, refresh } = useConfiguration();
  const [scan, setScan] = useState<Scan>({ kind: "scanning" });

  const run = useCallback(() => {
    setScan({ kind: "scanning" });
    scanSkillFolders().then(
      (result) => setScan({ kind: "ready", home: result.home, skills: foundSkills(result), truncated: result.truncated }),
      (error: unknown) => setScan({ kind: "error", message: error instanceof Error ? error.message : "扫描失败。" }),
    );
  }, []);
  useEffect(run, [run]);

  const records = data.collections.extensions;
  const saved = scan.kind === "ready"
    ? savedSkillDirs(records.filter((record) => record.values.kind === "skill").map((record) => String(record.values.command ?? "")), scan.home)
    : new Set<string>();
  const pending = scan.kind === "ready" ? scan.skills.filter((skill) => !saved.has(skill.dir)) : [];

  const add = (skills: FoundSkill[]) => {
    if (scan.kind !== "ready" || skills.length === 0) return;
    if (store.data.collections.extensions.length + skills.length > LIMIT) { onStatus(`工具配置最多 ${LIMIT} 份，请先删除不用的配置。`, true); return; }
    let added = 0;
    for (const skill of skills) {
      const values = { ...fieldDefaults(collectionSchemas.extensions.fields), kind: "skill", transport: "stdio",
        name: skill.name.slice(0, 72), command: displaySkillPath(skill.dir, scan.home) };
      if (store.saveRecord("extensions", values)) break;
      added += 1;
    }
    refresh();
    if (!store.storageAvailable) onStatus(store.notice || "本机存储暂不可用。", true);
    else if (added < skills.length) onStatus(`已添加 ${added} 个技能，其余未能保存。`, true);
    else onStatus(`已添加 ${added} 个技能到本机配置；执行层接入后按需读取。`);
  };

  return <section className="flex flex-col gap-2" aria-label="在本机发现的技能">
    <div className="flex items-end justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <SettingsSectionLabel>在本机发现{scan.kind === "ready" && scan.skills.length > 0 && ` · ${scan.skills.length}`}</SettingsSectionLabel>
        <p className="px-3 text-body-2-regular text-text-tertiary">
          扫描 {Object.values(SKILL_SOURCE_ROOTS).join("、")} 中带 SKILL.md 的文件夹，只读取名称与说明；由你决定添加哪些。
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {pending.length > 1 && <Button size="small" variant="secondary" onClick={() => add(pending)}>全部添加（{pending.length}）</Button>}
        <Button size="small" variant="ghost" iconOnly leadingIcon={RefreshCwIcon} aria-label="重新扫描" disabled={scan.kind === "scanning"} onClick={run} />
      </div>
    </div>
    <SettingsCard>
      {scan.kind === "scanning" && <p role="status" className="px-3 py-3 text-body-2-regular text-text-secondary">正在扫描…</p>}
      {scan.kind === "error" && <p role="alert" className="px-3 py-3 text-body-2-regular text-text-error-primary">{scan.message}</p>}
      {scan.kind === "ready" && scan.skills.length === 0 && <p className="px-3 py-3 text-body-2-regular text-text-secondary">这些位置没有找到技能文件夹。</p>}
      {scan.kind === "ready" && scan.skills.length > 0 && <ul aria-label="发现的技能">
        {scan.skills.map((skill) => {
          const added = saved.has(skill.dir);
          return <li key={skill.dir} className="flex items-center gap-3 border-b border-separator-border py-2.5 ps-3 pe-2.5 last:border-b-0">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 items-baseline gap-2">
                <span translate="no" className="truncate text-body-medium text-text-primary">{skill.name}</span>
                <span className="shrink-0 text-caption-1-regular text-text-tertiary">{SKILL_SOURCE_LABELS[skill.source]}</span>
              </span>
              {skill.description && <span className="line-clamp-2 text-body-2-regular text-text-secondary">{skill.description}</span>}
              <span translate="no" title={skill.dir} className="truncate text-caption-1-regular text-text-tertiary">{displaySkillPath(skill.dir, scan.home)}</span>
            </span>
            {added
              ? <span className="flex shrink-0 items-center gap-1 text-body-2-regular text-text-tertiary"><CheckIcon className="size-4" aria-hidden />已添加</span>
              : <Button size="small" variant="secondary" onClick={() => add([skill])} aria-label={`添加技能 ${skill.name}`}>添加</Button>}
          </li>;
        })}
      </ul>}
      {scan.kind === "ready" && scan.truncated && <p className="px-3 pb-3 text-body-2-regular text-text-tertiary">只列出前 300 个。</p>}
    </SettingsCard>
  </section>;
}
