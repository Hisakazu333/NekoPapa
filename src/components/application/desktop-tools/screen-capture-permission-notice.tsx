import { useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { desktopToolError, desktopTools, desktopToolsAvailable } from "@/app/desktop/desktop-tools";
import { toast } from "@/components/base/toast/toast";

export function ScreenCapturePermissionNotice() {
  useEffect(() => {
    if (!desktopToolsAvailable()) return;
    let active = true;
    const subscription = getCurrentWebviewWindow().listen("screen-notebook:permission-required", () => {
      if (!active) return;
      toast.info("当前 NekoPapa 尚未取得录屏权限", {
        id: "screen-notebook-permission",
        duration: 12000,
        description: "在 macOS 系统设置中允许录屏。若开关已打开，请完全退出 NekoPapa，再打开你使用的版本。",
        actions: [{
          label: "打开系统设置",
          onClick: () => void desktopTools.permissionSettings().catch((error) => toast.error(desktopToolError(error))),
        }],
      });
    }).catch(() => undefined);
    return () => { active = false; void subscription.then((unlisten) => unlisten?.()); };
  }, []);
  return null;
}
