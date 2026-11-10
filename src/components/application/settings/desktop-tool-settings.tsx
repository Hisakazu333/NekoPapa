import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/base/buttons/button";
import { StatusDot } from "@/components/base/badges/status-dot";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { CameraIcon, FolderOpenIcon } from "@/components/foundations/icons/app-icons";
import { desktopToolError, desktopTools, desktopToolsAvailable, type NotebookInfo } from "@/app/desktop/desktop-tools";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";

export function DesktopToolPanel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return <>
    <ModalBody><div className="flex flex-col gap-4">
      {!desktopToolsAvailable() && <p role="status" className="flex items-center gap-2 text-body-2-regular text-text-secondary">
        <StatusDot color="yellow" />请在 macOS 的 NekoPapa 桌面应用中使用。
      </p>}
      {children}
    </div></ModalBody>
    <ModalFooter><Button variant="secondary" onClick={onClose}>关闭</Button></ModalFooter>
  </>;
}

export function useDesktopAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true);
    setError("");
    try { await action(); }
    catch (failure) { setError(desktopToolError(failure)); }
    finally { setPending(false); }
  };
  return { pending, error, run, setError };
}

export function ScreenIslandSettings({ onClose }: { onClose: () => void }) {
  const available = desktopToolsAvailable();
  const { pending, error, run, setError } = useDesktopAction();
  const [info, setInfo] = useState<NotebookInfo>();
  useEffect(() => {
    if (!available) return;
    let active = true;
    const refresh = () => void desktopTools.notebook().then((next) => {
      if (active) setInfo(next);
    }).catch((failure) => { if (active) setError(desktopToolError(failure)); });
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [available, setError]);
  return <DesktopToolPanel onClose={onClose}>
    <SettingsSectionLabel>屏幕取材</SettingsSectionLabel>
    <SettingsCard>
      <SettingsRow label="灵动岛" description="在屏幕顶端打开小岛。点「截取屏幕」直接框选，截图完成后才打开编辑。">
        <Button size="small" leadingIcon={CameraIcon} disabled={!available || pending} onClick={() => void run(desktopTools.island)}>打开灵动岛</Button>
      </SettingsRow>
      <SettingsRow label="屏幕录制权限" description={info?.screenPermission ? "可以手动框选屏幕。识别在本机完成。" : "首次框选时由 macOS 询问。可以在系统设置里查看权限。"}>
        <Button size="small" variant="secondary" disabled={!available || pending} onClick={() => void run(desktopTools.permissionSettings)}>系统设置</Button>
      </SettingsRow>
    </SettingsCard>
    <SettingsSectionLabel>本机笔记</SettingsSectionLabel>
    <SettingsCard>
      <SettingsRow label="学习笔记和代码草稿" description="确认后保存 Markdown。识别结果可以编辑，也可带到工作台开始新对话。">
        <Button size="small" variant="secondary" leadingIcon={FolderOpenIcon} disabled={!available || pending}
          onClick={() => void run(desktopTools.openNotes)}>打开目录</Button>
      </SettingsRow>
    </SettingsCard>
    {info && <p translate="no" className="break-all text-caption-1-regular text-text-secondary">{info.directory}</p>}
    {error && <p role="alert" className="text-body-2-regular text-text-error-primary">{error}</p>}
  </DesktopToolPanel>;
}
