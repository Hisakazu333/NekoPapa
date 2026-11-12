import { ArrowDownIcon, ArrowUpIcon } from "@/components/foundations/icons/app-icons";
import { SLOT_LABELS } from "@/app/plugins/slot-registry";
import { useWorkPanelViews } from "@/hooks/use-ui-plugins";
import { Button } from "@/components/base/buttons/button";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { Switch } from "@/components/base/switch/switch";
import { useSlotLayout } from "@/hooks/use-slot-layout";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";

/**
 * 界面布局: the arrangement of the workbench's extension slots on this
 * device. Stage 1 opens one slot, the work panel's tabs: show or hide each
 * (required tabs say why they stay), move the shown ones and restore the
 * default order. Changes apply at once, the same as the tabs' right-click
 * menu, and are saved with the layout.
 */
export function LayoutSettingsPanel({ onClose }: { onClose: () => void }) {
  const slot = useSlotLayout("workPanel.view", useWorkPanelViews());
  const rows = [...slot.shown, ...slot.hidden];
  return <>
    <ModalBody>
      <div className="flex flex-col gap-3">
        <SettingsSectionLabel>{SLOT_LABELS["workPanel.view"]}</SettingsSectionLabel>
        <SettingsCard>
          {rows.map((entry) => {
            const index = slot.shown.indexOf(entry);
            const shown = index >= 0;
            return <SettingsRow key={entry.id} label={entry.label}
              description={entry.required ? `始终显示：${entry.requiredReason ?? ""}` : [entry.plugin && `来自界面插件“${entry.plugin.pluginName}”`, !shown && "已隐藏"].filter(Boolean).join(" · ") || undefined}>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="small" iconOnly leadingIcon={ArrowUpIcon} aria-label={`把“${entry.label}”向前移`}
                  disabled={!shown || index === 0} onClick={() => slot.move(entry, -1)} />
                <Button variant="ghost" size="small" iconOnly leadingIcon={ArrowDownIcon} aria-label={`把“${entry.label}”向后移`}
                  disabled={!shown || index === slot.shown.length - 1} onClick={() => slot.move(entry, 1)} />
                <Switch aria-label={`显示“${entry.label}”标签`} isSelected={shown} isDisabled={entry.required}
                  onChange={(next) => (next ? slot.show(entry) : slot.hide(entry))} />
              </div>
            </SettingsRow>;
          })}
        </SettingsCard>
        <p className="text-body-2-regular text-text-tertiary">也可以在工作面板的标签上右键调整。布局只保存在这台设备上；目前只开放工作面板标签，其他位置会逐步开放。启用的界面插件的标签也列在这里。</p>
      </div>
    </ModalBody>
    <ModalFooter>
      <Button variant="secondary" onClick={slot.reset} disabled={!slot.customized}>恢复默认</Button>
      <Button variant="secondary" onClick={onClose}>关闭</Button>
    </ModalFooter>
  </>;
}
