import { useEffect, useRef, type ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/foundations/icons/app-icons";
import { isMacTauriWindow, useMacWindowFullscreen } from "@/components/application/dashboard/mac-window-frame";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";
import { cx } from "@/utils/cx";

export function AccountPageFrame({ title, onBack, backLabel = "返回工作区", actions, children }: {
  title: string;
  onBack: () => void;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const page = useRef<HTMLElement>(null);
  const mac = isMacTauriWindow();
  const fullscreen = useMacWindowFullscreen(mac);

  useEffect(() => { page.current?.focus(); }, []);

  return <main
    ref={page}
    tabIndex={-1}
    aria-label={title}
    onKeyDownCapture={(event) => {
      if (event.key !== "Escape" || !(event.target instanceof Element) ||
        !event.currentTarget.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      onBack();
    }}
    className="fixed inset-0 z-90 flex min-h-0 flex-col bg-background-full text-text-primary outline-none"
  >
    <header className={cx("flex h-10 shrink-0 select-none items-center gap-2 ps-3 pe-4 sm:pe-6", mac && !fullscreen && "ps-[88px]")}>
      <ToolbarIconButton icon={ChevronLeftIcon} label={backLabel} onPress={onBack} />
      <div data-tauri-drag-region={mac || undefined} className="h-full flex-1" />
      {actions}
    </header>
    {children}
  </main>;
}
