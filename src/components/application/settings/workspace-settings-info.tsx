import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import { Button } from "@/components/base/buttons/button";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { useConfiguration } from "@/hooks/use-configuration";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { SettingsCard, SettingsRow } from "./settings-rows";
import type { SettingsSection } from "./workspace-settings-catalog";

export function GeneralSettingsPanel({ onClose, onNavigate }: {
  onClose: () => void;
  onNavigate: (section: SettingsSection) => void;
}) {
  const localize = useTemplateCopy();
  const { data, storageAvailable, notice } = useConfiguration();
  const { profile } = useLocalProfile();
  const collections = data.collections;
  return localize((<>
    <ModalBody>
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-separator-border p-4">
          <p translate="no" className="text-title-3-medium text-text-primary">{profile.name}</p>
          <p className="mt-1 text-body-regular text-text-secondary">本机资料</p>
          <p className="mt-3 text-body-2-regular text-text-tertiary">资料、默认配置和设置备份保存在当前设备。</p>
        </div>
        <SettingsCard>
          <SettingsRow label="个人资料" description="编辑账号菜单显示的名称、介绍和个人网站。">
            <Button variant="secondary" size="small" onClick={() => onNavigate("profile")}>编辑</Button>
          </SettingsRow>
          <SettingsRow label="模型与 API" description={`已保存 ${collections.models.length} 份自定义 API 配置。`}>
            <Button variant="secondary" size="small" onClick={() => onNavigate("model")}>管理</Button>
          </SettingsRow>
          <SettingsRow label="工具与技能" description={`已保存 ${collections.extensions.length} 份工具、技能或连接器配置。`}>
            <Button variant="secondary" size="small" onClick={() => onNavigate("tools")}>管理</Button>
          </SettingsRow>
          <SettingsRow label="设备与 SSH" description={`已保存 ${collections.connections.length} 份设备配置。`}>
            <Button variant="secondary" size="small" onClick={() => onNavigate("connections")}>管理</Button>
          </SettingsRow>
          <SettingsRow label="生命周期钩子" description={`已保存 ${collections.hooks.length} 份钩子配置。`}>
            <Button variant="secondary" size="small" onClick={() => onNavigate("hooks")}>管理</Button>
          </SettingsRow>
        </SettingsCard>
        <SettingsCard>
          <SettingsRow label="数据与备份" description="导出当前设置，或检查备份后再恢复。">
            <Button variant="secondary" size="small" onClick={() => onNavigate("data")}>打开</Button>
          </SettingsRow>
          <SettingsRow label="快捷键" description="查看当前聊天页支持的键盘操作。">
            <Button variant="secondary" size="small" onClick={() => onNavigate("shortcuts")}>查看</Button>
          </SettingsRow>
        </SettingsCard>
        {!storageAvailable && <p role="alert" className="text-body-regular text-text-error-primary">{notice || "本机存储暂不可用；请在相应设置中重试保存。"}</p>}
      </div>
    </ModalBody>
    <ModalFooter><Button variant="secondary" onClick={onClose}>关闭</Button></ModalFooter>
  </>));
}

const shortcuts = [
  { keys: "⌘L / Ctrl+K", action: "快速搜索", description: "搜索会话内容、联系人名称和设置分类。" },
  { keys: "Enter", action: "发送消息", description: "在聊天输入框中发送；需要可用的模型连接。" },
  { keys: "Shift + Enter", action: "插入换行", description: "在聊天输入框中继续编写多行消息。" },
  { keys: "Escape", action: "关闭弹窗", description: "关闭当前可取消的对话框。" },
  { keys: "⌘ / Ctrl + ,", action: "打开或关闭设置", description: "macOS 使用 ⌘，Windows 和 Linux 使用 Ctrl。" },
] as const;

export function ShortcutsSettingsPanel({ onClose }: { onClose: () => void }) {
  return <>
    <ModalBody>
      <SettingsCard>
        {shortcuts.map(({ keys, action, description }) => <SettingsRow key={keys} label={action} description={description}>
          <kbd className="shrink-0 rounded-lg border border-border-button-default bg-background-full px-2 py-1 font-mono text-body-2-regular text-text-primary">{keys}</kbd>
        </SettingsRow>)}
      </SettingsCard>
    </ModalBody>
    <ModalFooter><Button variant="secondary" onClick={onClose}>关闭</Button></ModalFooter>
  </>;
}

export function AboutSettingsPanel({ onClose }: { onClose: () => void }) {
  return <>
    <ModalBody>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <img src="/brand/nekopapa-favicon-v1.png" alt="" className="size-12" />
          <div><p className="text-title-3-medium text-text-primary">NekoPapa</p><p className="text-body-regular text-text-secondary">版本 0.1.0</p></div>
        </div>
        <p>一个正在开发的 AI 桌面伙伴，陪你聊天，也为未来的代码项目与桌面协作准备工作区。</p>
        <SettingsCard>
          <SettingsRow label="帮助文档" description="查看项目说明、使用方式和开发进度。"><a className="shrink-0 text-body-medium text-text-primary underline underline-offset-4" href="https://github.com/Hisakazu333/NekoPapa#readme" target="_blank" rel="noreferrer">打开文档</a></SettingsRow>
          <SettingsRow label="反馈问题" description="提交问题、复现步骤或界面建议。"><a className="shrink-0 text-body-medium text-text-primary underline underline-offset-4" href="https://github.com/Hisakazu333/NekoPapa/issues" target="_blank" rel="noreferrer">前往反馈</a></SettingsRow>
          <SettingsRow label="开源许可证"><span className="text-body-regular text-text-primary">Apache License 2.0</span></SettingsRow>
        </SettingsCard>
        <p className="text-body-2-regular text-text-tertiary">聊天界面基于 BoardUI。账号、Live2D、语音与工具执行等能力以各设置页说明的实际接入状态为准。</p>
      </div>
    </ModalBody>
    <ModalFooter><Button variant="secondary" onClick={onClose}>关闭</Button></ModalFooter>
  </>;
}
