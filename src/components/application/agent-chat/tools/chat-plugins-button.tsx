import { useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { RiBookShelfLine, RiExternalLinkLine, RiGithubLine, RiLink, RiPlugLine, RiPuzzle2Line, RiSettings3Line } from "@remixicon/react";
import { DSH_PLUGIN_SEARCH_URL, openExternal } from "@/platform/open-external";
import type { ConfigurationRecord } from "@/app/configuration-types";
import { Button } from "@/components/base/buttons/button";
import { Popover, PopoverHeader, PopoverTrigger } from "@/components/base/popover/popover";
import { toolbarIconButtonClass, toolbarIconClass } from "@/components/application/dashboard/toolbar-icon-button";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { useConfiguration } from "@/hooks/use-configuration";
import { cx } from "@/utils/cx";

const kinds = {
  mcp: { label: "MCP 服务", icon: RiPlugLine },
  skill: { label: "技能目录", icon: RiBookShelfLine },
  connector: { label: "连接器", icon: RiLink },
} as const;
type Kind = keyof typeof kinds;
const kindOf = (record: ConfigurationRecord): Kind => record.values.kind === "skill" || record.values.kind === "connector" ? record.values.kind : "mcp";
const detailOf = (record: ConfigurationRecord) => String((record.values.transport === "http" ? record.values.endpoint : record.values.command) ?? "");

/**
 * 插件与工具, in two parts that are different things. DeepSeek Harness
 * plugins are JS / TS modules (`apply(ctx)`, loaded by Cordis config); none
 * can be installed before the execution layer exists, so that part only
 * explains this, links to 设置 → 开发 → Cordis 插件 and to GitHub search. Below it are the MCP services,
 * skill folders and connectors saved under 设置 →
 * MCP 与连接器 and 设置 → 技能, as the open chat would get them. Nothing runs
 * them yet — the Coding 执行层 is not connected — so each says so instead of
 * showing a live status. The two buttons open those settings pages. The
 * GitHub button only opens GitHub's own search in the system browser: no
 * results are fetched or shown here, and no GitHub sign-in is needed.
 */
export function ChatPluginsButton() {
  const { data } = useConfiguration();
  const openSettings = useWorkspaceSettings();
  const [open, setOpen] = useState(false);
  const [linkError, setLinkError] = useState("");
  const searchGitHub = () => {
    setLinkError("");
    openExternal(DSH_PLUGIN_SEARCH_URL).then(() => setOpen(false), (error: unknown) => setLinkError(error instanceof Error ? error.message : "无法打开系统浏览器。"));
  };
  const trigger = useRef<HTMLButtonElement>(null);
  const records = data.collections.extensions ?? [];
  const manage = (section: "tools" | "skills" | "plugins") => { setOpen(false); openSettings(section, trigger.current); };
  const plugins = data.collections.plugins ?? [];
  const pluginLabel = plugins.length ? `管理 Cordis 插件配置（已保存 ${plugins.length} 项）` : "管理 Cordis 插件配置";
  const label = records.length ? `插件与工具（已配置 ${records.length} 项）` : "插件与工具";

  return <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
    <AriaButton ref={trigger} aria-label={label} className={cx(toolbarIconButtonClass, open && "bg-background-primary-hover text-text-primary")}>
      <RiPuzzle2Line className={toolbarIconClass} aria-hidden />
    </AriaButton>
    <Popover aria-label="插件与工具" placement="bottom end" className="w-[320px]">
      <PopoverHeader title="插件与工具" description="Coding 执行层尚未接入，下面的内容都不会运行。" />
      <section aria-label="DeepSeek Harness 插件" className="flex flex-col gap-2">
        <h3 className="text-caption-1-medium text-text-tertiary">DeepSeek Harness 插件</h3>
        <p className="text-body-2-regular text-text-secondary">
          dsh 插件是 TypeScript / JavaScript 模块（导出 <code translate="no" className="font-mono text-caption-1-regular">apply(ctx)</code>，由 Cordis 配置加载），与技能和 MCP 不同。可在设置 → 开发 → Cordis 插件中保存配置条目；执行层接入前不会加载。
        </p>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" leadingIcon={RiSettings3Line} className="flex-1" onClick={() => manage("plugins")}
            aria-label={pluginLabel}>Cordis 插件</Button>
          <Button size="small" variant="secondary" leadingIcon={RiGithubLine} trailingIcon={RiExternalLinkLine} className="flex-1" onClick={searchGitHub}
            aria-label="在 GitHub 搜索 DeepSeek Harness 插件（在系统浏览器中打开）" title="在 GitHub 搜索 DeepSeek Harness 插件">
            GitHub 搜索
          </Button>
        </div>
        {linkError && <p role="alert" className="text-body-2-regular text-text-error-primary">{linkError}</p>}
      </section>
      <section aria-label="工具配置" className="flex flex-col gap-2 border-t border-separator-border pt-3">
        <h3 className="text-caption-1-medium text-text-tertiary">MCP、技能与连接器（本机配置）</h3>
        {records.length === 0
          ? <p className="rounded-xl bg-background-secondary-default px-3 py-3 text-body-2-regular text-text-secondary">
            还没有配置 MCP 服务、技能目录或连接器。
          </p>
          : <ul className="flex max-h-[240px] flex-col overflow-y-auto">
            {records.map((record) => {
              const kind = kinds[kindOf(record)];
              const detail = detailOf(record);
              return <li key={record.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2">
                <kind.icon className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span translate="no" className="truncate text-body-2-medium text-text-primary">{String(record.values.name ?? "未命名")}</span>
                  <span className="truncate text-caption-1-regular text-text-tertiary">{kind.label}{detail && <> · <span translate="no">{detail}</span></>}</span>
                </span>
                <span className="shrink-0 text-caption-1-regular text-text-tertiary">未运行</span>
              </li>;
            })}
          </ul>}
        <div className="flex gap-2">
          <Button size="small" variant="secondary" leadingIcon={RiSettings3Line} className="flex-1" onClick={() => manage("tools")}>MCP 与连接器</Button>
          <Button size="small" variant="secondary" leadingIcon={RiBookShelfLine} className="flex-1" onClick={() => manage("skills")}>技能</Button>
        </div>
      </section>
    </Popover>
  </PopoverTrigger>;
}
