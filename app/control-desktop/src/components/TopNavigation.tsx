import type { MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  Globe2,
  Home,
  MessageCircle,
  Settings,
  Zap,
} from "lucide-react";
import type { PageId } from "../App";
import type { Live2DRenderState } from "./Live2DCompanion";

interface NavigationItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
}

const navigationItems: NavigationItem[] = [
  { id: "stage", label: "舞台", icon: Home },
  { id: "conversation", label: "对话", icon: MessageCircle },
  { id: "memory", label: "记忆", icon: Bookmark },
  { id: "world", label: "世界", icon: Globe2 },
];

interface TopNavigationProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  stageRunning: boolean;
  live2dState: Live2DRenderState;
}

const live2dLabels: Record<Live2DRenderState, string> = {
  idle: "Live2D 未挂载",
  loading: "Live2D 加载中",
  ready: "Live2D 已加载",
  error: "Live2D 异常",
};

type WindowAction = "close" | "minimize" | "maximize";

async function runWindowAction(action: WindowAction) {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;

  const appWindow = getCurrentWindow();

  if (action === "close") await appWindow.close();
  else if (action === "minimize") await appWindow.minimize();
  else await appWindow.toggleMaximize();
}

async function startWindowDrag(event: ReactMouseEvent<HTMLElement>) {
  if (event.button !== 0 || typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  if (event.target instanceof Element && event.target.closest("button")) return;

  event.preventDefault();
  await getCurrentWindow().startDragging();
}

export function TopNavigation({
  activePage,
  onNavigate,
  stageRunning,
  live2dState,
}: TopNavigationProps) {
  return (
    <header className="app-header">
      <div
        className="window-titlebar"
        onMouseDown={(event) => void startWindowDrag(event)}
      >
        <div className="traffic-lights" aria-label="窗口控制">
          <button
            type="button"
            className="traffic-light traffic-light--close"
            aria-label="关闭窗口"
            title="关闭"
            onClick={() => void runWindowAction("close")}
          />
          <button
            type="button"
            className="traffic-light traffic-light--minimize"
            aria-label="最小化窗口"
            title="最小化"
            onClick={() => void runWindowAction("minimize")}
          />
          <button
            type="button"
            className="traffic-light traffic-light--maximize"
            aria-label="切换窗口大小"
            title="切换窗口大小"
            onClick={() => void runWindowAction("maximize")}
          />
        </div>
        <strong>NekoPapa</strong>
      </div>

      <div
        className="topbar"
        onMouseDown={(event) => void startWindowDrag(event)}
      >
        <div className="runtime-pills" aria-label="运行状态">
          <span className={`runtime-pill ${live2dState === "ready" ? "is-online" : ""} ${live2dState === "error" ? "is-error" : ""}`}>
            <i />{live2dLabels[live2dState]}
          </span>
          <span className={`runtime-pill ${live2dState === "ready" ? "is-online" : ""}`}>
            <i />角色{live2dState === "ready" ? "在线" : "待机"}
          </span>
          <span className={`runtime-pill ${stageRunning ? "is-online" : ""}`}>
            <i />桌面{stageRunning ? "在线" : "离线"}
          </span>
        </div>

        <nav className="topnav" aria-label="主导航">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = item.id === activePage;
            return (
              <button
                key={item.id}
                type="button"
                className={`topnav__item ${active ? "topnav__item--active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            className={`agent-shortcut ${activePage === "agent" ? "is-active" : ""}`}
            onClick={() => onNavigate("agent")}
          >
            <Zap size={17} aria-hidden="true" />
            <span>Agent</span>
          </button>
          <span className="runtime-state">
            <i className={stageRunning ? "is-online" : ""} />
            {stageRunning ? "运行中" : "待启动"}
          </span>
          <button
            type="button"
            className={`topbar-settings ${activePage === "settings" ? "is-active" : ""}`}
            aria-label="设置"
            title="设置"
            onClick={() => onNavigate("settings")}
          >
            <Settings size={22} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
