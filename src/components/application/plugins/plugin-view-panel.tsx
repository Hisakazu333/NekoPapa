import type { WorkPanelViewContribution } from "@/app/plugins/slot-registry";
import { unmetRequirement } from "@/app/plugins/plugin-host";
import { StatusDot } from "@/components/base/badges/status-dot";
import { pluginIcon } from "./plugin-icons";
import { PluginFrameView } from "./plugin-frame-view";

/**
 * A plugin's work panel view, marked as coming from that plugin, with the
 * reason when a requirement (desktop app, Coding, NekoBuddy backend) is not
 * met. A status view is text NekoPapa draws; a frame view is the plugin's
 * own page in a sandboxed frame (plugin-frame-view.tsx), loaded only once
 * every requirement is met.
 */
export function PluginViewPanel({ entry }: { entry: WorkPanelViewContribution }) {
  const plugin = entry.plugin!;
  const Icon = pluginIcon(plugin.icon);
  const unmet = unmetRequirement(plugin.requires);
  return <div className={entry.frame ? "flex min-h-0 flex-1 flex-col gap-3" : "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"}>
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
    {entry.frame
      ? !unmet && <PluginFrameView key={entry.id} entry={entry} />
      : <p className="whitespace-pre-line px-1 text-body-2-regular text-text-secondary">{entry.status}</p>}
  </div>;
}
