import type { WorkPanelViewContribution } from "@/app/plugins/slot-registry";
import { unmetRequirement } from "@/app/plugins/plugin-host";
import { StatusDot } from "@/components/base/badges/status-dot";
import { pluginIcon } from "./plugin-icons";

/**
 * A plugin's work panel view. NekoPapa draws it: the plugin's status text,
 * marked as coming from that plugin, and the reason when a requirement
 * (desktop app, Coding, NekoBuddy backend) is not met. No plugin code runs.
 */
export function PluginViewPanel({ entry }: { entry: WorkPanelViewContribution }) {
  const plugin = entry.plugin!;
  const Icon = pluginIcon(plugin.icon);
  const unmet = unmetRequirement(plugin.requires);
  return <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
    <div className="flex items-center gap-2.5 px-1">
      <Icon className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
      <div className="flex min-w-0 flex-col">
        <p className="truncate text-body-medium text-text-primary">{entry.label}</p>
        <p className="truncate text-caption-1-regular text-text-tertiary">来自界面插件“{plugin.pluginName}”</p>
      </div>
    </div>
    {unmet && <div role="status" className="flex items-start gap-2.5 rounded-2xl bg-background-primary-default p-3">
      <StatusDot color="yellow" className="mt-1" />
      <p className="text-body-2-regular text-text-secondary">{unmet}</p>
    </div>}
    <p className="whitespace-pre-line px-1 text-body-2-regular text-text-secondary">{entry.status}</p>
  </div>;
}
