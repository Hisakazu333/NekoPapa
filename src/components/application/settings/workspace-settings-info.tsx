import { Button } from "@/components/base/buttons/button";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { useConfiguration } from "@/hooks/use-configuration";
import { ConfigurationGroupPanel } from "./nekopapa-configuration-settings";
import { SettingsCard, SettingsRow } from "./settings-rows";

/**
 * General: how new chats start and how messages are sent (these work now),
 * then the desktop blocks that wait for the host. The local profile has its
 * own page, and the interface language stays in the account menu.
 */
export function GeneralSettingsPanel({ onClose }: { onClose: () => void }) {
  return <ConfigurationGroupPanel group="general" onClose={onClose} />;
}

/** Send and newline keys follow the General setting, so this list never contradicts it. */
function shortcutList(sendKey: unknown) {
  const modEnter = sendKey === "mod-enter";
  return [
    { keys: "⌘L / Ctrl+K", action: "快速搜索", description: "搜索会话内容、联系人名称和设置分类。" },
    { keys: "⌘B / Ctrl+B", action: "隐藏或显示侧栏", description: "完全隐藏桌面侧栏，再按一次恢复；也可以点标题栏左侧的侧栏按钮。" },
    { keys: modEnter ? "⌘ / Ctrl + Enter" : "Enter", action: "发送消息", description: "在聊天输入框中发送；需要可用的模型连接。可在“常规”中更改。" },
    { keys: modEnter ? "Enter" : "Shift + Enter", action: "插入换行", description: "在聊天输入框中继续编写多行消息。" },
    { keys: "Escape", action: "关闭弹窗", description: "关闭当前可取消的对话框。" },
    { keys: "⌘ / Ctrl + ,", action: "打开或关闭设置", description: "macOS 使用 ⌘，Windows 和 Linux 使用 Ctrl。" },
  ];
}

export function ShortcutsSettingsPanel({ onClose }: { onClose: () => void }) {
  const { data } = useConfiguration();
  const shortcuts = shortcutList(data.groups.general.sendKey);
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
