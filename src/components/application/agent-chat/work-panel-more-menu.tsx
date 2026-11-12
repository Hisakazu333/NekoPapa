import { useState } from "react";
import { EllipsisIcon, LayoutPanelLeftIcon, PuzzleIcon } from "@/components/foundations/icons/app-icons";
import type { WorkPanelViewContribution } from "@/app/plugins/slot-registry";
import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { pluginIcon } from "@/components/application/plugins/plugin-icons";

const ROW = "gap-3";
const ICON = "size-[18px] shrink-0 text-foreground-icon-secondary";

/**
 * 更多工具: the work panel's "more" menu, after the tabs (the right sidebar's
 * 更多 in DeepSeek Harness). It lists the hidden tabs, where choosing one
 * shows it again and opens it, then the layout settings and the interface
 * plugin page. Hidden tabs stay reachable here and in the right-click menu.
 */
export function WorkPanelMoreMenu({ hidden, onOpenHidden, onLayout, onPlugins }: {
  hidden: readonly WorkPanelViewContribution[];
  onOpenHidden: (entry: WorkPanelViewContribution) => void;
  onLayout: () => void;
  onPlugins: () => void;
}) {
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => () => { setOpen(false); action(); };
  return <Dropdown isOpen={open} onOpenChange={setOpen}>
    <DropdownTrigger aria-label="更多工具"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground-icon-secondary hover:bg-background-secondary-hover hover:text-text-primary">
      <EllipsisIcon className="size-[18px]" aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label="更多工具" placement="bottom end" className="w-[220px]">
      {hidden.map((entry) => {
        const Icon = entry.plugin ? pluginIcon(entry.plugin.icon) : EllipsisIcon;
        return <DropdownItem key={entry.id} onSelect={run(() => onOpenHidden(entry))} className={ROW}>
          {entry.plugin ? <Icon className={ICON} aria-hidden /> : <span className="size-[18px] shrink-0" aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{entry.label}</span>
          <span className="shrink-0 text-caption-1-regular text-text-tertiary">已隐藏</span>
        </DropdownItem>;
      })}
      {hidden.length > 0 && <DropdownDivider />}
      <DropdownItem onSelect={run(onLayout)} className={ROW}><LayoutPanelLeftIcon className={ICON} aria-hidden />界面布局设置…</DropdownItem>
      <DropdownItem onSelect={run(onPlugins)} className={ROW}><PuzzleIcon className={ICON} aria-hidden />管理界面插件…</DropdownItem>
    </DropdownPopover>
  </Dropdown>;
}
