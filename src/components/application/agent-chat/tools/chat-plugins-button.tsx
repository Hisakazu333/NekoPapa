import { useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { RiBookShelfLine, RiLink, RiPlugLine, RiPuzzle2Line, RiSettings3Line } from "@remixicon/react";
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
 * 插件: the MCP services, skill folders and connectors saved under 设置 →
 * MCP 与连接器 and 设置 → 技能, as the open chat would get them. Nothing runs
 * them yet — the Coding 执行层 is not connected — so each says so instead of
 * showing a live status. The two buttons open those settings pages.
 */
export function ChatPluginsButton() {
  const { data } = useConfiguration();
  const openSettings = useWorkspaceSettings();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const records = data.collections.extensions ?? [];
  const manage = (section: "tools" | "skills") => { setOpen(false); openSettings(section, trigger.current); };
  const label = records.length ? `插件与工具（已配置 ${records.length} 项）` : "插件与工具";

  return <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
    <AriaButton ref={trigger} aria-label={label} className={cx(toolbarIconButtonClass, open && "bg-background-primary-hover text-text-primary")}>
      <RiPuzzle2Line className={toolbarIconClass} aria-hidden />
    </AriaButton>
    <Popover aria-label="插件与工具" placement="bottom end" className="w-[320px]">
      <PopoverHeader title="插件与工具" description="Coding 执行层尚未接入。这里的配置只保存在本机，不会启动命令或连接服务。" />
      {records.length === 0
        ? <p className="rounded-xl bg-background-secondary-default px-3 py-3 text-body-2-regular text-text-secondary">
          还没有配置 MCP 服务、技能目录或连接器。
        </p>
        : <ul className="flex max-h-[280px] flex-col overflow-y-auto">
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
      {records.length > 0 && <p className="text-caption-1-regular text-text-tertiary">接入执行层后，这些 MCP 服务与技能目录将交给它加载。</p>}
      <div className="flex gap-2">
        <Button size="small" variant="secondary" leadingIcon={RiSettings3Line} className="flex-1" onClick={() => manage("tools")}>MCP 与连接器</Button>
        <Button size="small" variant="secondary" leadingIcon={RiBookShelfLine} className="flex-1" onClick={() => manage("skills")}>技能</Button>
      </div>
    </Popover>
  </PopoverTrigger>;
}
