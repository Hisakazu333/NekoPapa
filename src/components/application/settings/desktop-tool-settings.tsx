import { useState, type ReactNode } from "react";
import { StatusDot } from "@/components/base/badges/status-dot";
import { Button } from "@/components/base/buttons/button";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";

function SettingsPage({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const localize = useTemplateCopy();
  return localize(<>
    <ModalBody>
      <div className="flex flex-col gap-3">
        <p role="status" className="flex items-center gap-2 text-body-2-regular text-text-secondary">
          <StatusDot color="yellow" aria-hidden />功能暂未接入
        </p>
        {children}
      </div>
    </ModalBody>
    <ModalFooter><Button variant="secondary" onClick={onClose}>关闭</Button></ModalFooter>
  </>);
}

export function ScreenIslandSettings({ onClose }: { onClose: () => void }) {
  return <SettingsPage onClose={onClose}>
    <SettingsSectionLabel>屏幕取材</SettingsSectionLabel>
    <SettingsCard>
      <SettingsRow label="刘海取材手势" description="当前版本无法从刘海下拉截图。" />
      <SettingsRow label="截图编辑" description="选区预览与编辑暂不可用。" />
      <SettingsRow label="屏幕录制权限" description="当前版本不会请求录屏权限。" />
    </SettingsCard>
  </SettingsPage>;
}

export function DesktopPetSettings({ onClose }: { onClose: () => void }) {
  const [source, setSource] = useState<"local" | "account">("local");
  return <SettingsPage onClose={onClose}>
    <SettingsSectionLabel>模型来源</SettingsSectionLabel>
    <SegmentedControl aria-label="模型来源" selectedKeys={[source]} onSelectionChange={(keys) => {
      const next = [...keys][0];
      if (next === "local" || next === "account") setSource(next);
    }}>
      <SegmentedControlItem id="local">本机模型</SegmentedControlItem>
      <SegmentedControlItem id="account">账号模型</SegmentedControlItem>
    </SegmentedControl>
    <SettingsCard>
      {source === "local"
        ? <SettingsRow label="本机 Live2D 模型" description="当前版本无法导入或加载本机模型。" />
        : <SettingsRow label="Live2D 账号模型" description="当前版本无法选择账号同伴或上传私人模型。" />}
      <SettingsRow label="桌面陪伴" description="桌宠窗口暂不可用。" />
    </SettingsCard>
  </SettingsPage>;
}
