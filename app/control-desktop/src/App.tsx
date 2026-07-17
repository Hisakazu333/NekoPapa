import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CloudOff, Database, ShieldCheck } from "lucide-react";
import { TopNavigation } from "./components/TopNavigation";
import type { Live2DRenderState } from "./components/Live2DCompanion";
import {
  getStageStatus,
  startStage,
  stopStage,
  type StageStatus,
} from "./bridge/stage";
import { AgentPage } from "./pages/AgentPage";
import { ConversationPage } from "./pages/ConversationPage";
import { MemoryPage } from "./pages/MemoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StagePage } from "./pages/StagePage";
import { WorldPage } from "./pages/WorldPage";

export type PageId =
  | "stage"
  | "conversation"
  | "memory"
  | "world"
  | "agent"
  | "settings";

const initialStageStatus: StageStatus = {
  state: "stopped",
  pid: null,
  message: "正在读取 Stage 状态",
  simulated: false,
  updatedAt: new Date().toISOString(),
};

const errorStatus = (error: unknown): StageStatus => ({
  state: "error",
  pid: null,
  message: error instanceof Error ? error.message : "Stage 命令执行失败",
  simulated: false,
  updatedAt: new Date().toISOString(),
});

const HOME_DESIGN_WIDTH = 1550;
const HOME_DESIGN_HEIGHT = 914;
const HOME_HEADER_HEIGHT = 114;

export default function App() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState<PageId>("stage");
  const [stageStatus, setStageStatus] = useState<StageStatus>(initialStageStatus);
  const [stageBusy, setStageBusy] = useState(false);
  const [live2dState, setLive2dState] = useState<Live2DRenderState>("idle");
  const [pendingHomeMessage, setPendingHomeMessage] = useState<{
    id: number;
    text: string;
  } | null>(null);

  const refreshStageStatus = useCallback(async () => {
    try {
      setStageStatus(await getStageStatus());
    } catch (error) {
      setStageStatus(errorStatus(error));
    }
  }, []);

  useEffect(() => {
    void refreshStageStatus();
  }, [refreshStageStatus]);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const header = shell.querySelector<HTMLElement>(".app-header");
    const canvas = shell.querySelector<HTMLElement>(".home-ui-canvas");
    if (activePage !== "stage" || !header || !canvas) return;

    const clearDesktopScale = () => {
      shell.style.removeProperty("grid-template-rows");
      header.style.removeProperty("transform");
      canvas.style.removeProperty("transform");
    };

    const updateScale = () => {
      if (window.innerWidth <= 840) {
        clearDesktopScale();
        return;
      }

      // Keep the resize hot path compositor-only. The Live2D renderer and the
      // fixed design canvas retain their internal dimensions while this changes.
      const width = window.innerWidth;
      const height = window.innerHeight;
      const scale = Math.max(
        0.6,
        Math.min(1, width / HOME_DESIGN_WIDTH, height / HOME_DESIGN_HEIGHT),
      );
      const offsetX = Math.max(0, (width - HOME_DESIGN_WIDTH * scale) / 2);
      const offsetY = Math.max(0, (height - HOME_DESIGN_HEIGHT * scale) / 2);

      const compositorScale = scale.toFixed(5);
      const compositorOffsetX = offsetX.toFixed(2);
      const compositorOffsetY = offsetY.toFixed(2);
      shell.style.gridTemplateRows = `${(HOME_HEADER_HEIGHT * scale).toFixed(2)}px minmax(0, 1fr)`;
      header.style.transform = `translate3d(${compositorOffsetX}px, 0, 0) scale(${compositorScale})`;
      canvas.style.transform = `translate3d(${compositorOffsetX}px, ${compositorOffsetY}px, 0) scale(${compositorScale})`;
    };

    window.addEventListener("resize", updateScale, { passive: true });
    updateScale();

    return () => {
      window.removeEventListener("resize", updateScale);
      clearDesktopScale();
    };
  }, [activePage]);

  const runStageAction = useCallback(async (action: "start" | "stop") => {
    setStageBusy(true);
    setStageStatus((current) => ({
      ...current,
      state: action === "start" ? "starting" : "stopping",
      message: action === "start" ? "正在启动桌宠舞台" : "正在停止桌宠舞台",
    }));

    try {
      const nextStatus = action === "start" ? await startStage() : await stopStage();
      setStageStatus(nextStatus);
    } catch (error) {
      setStageStatus(errorStatus(error));
    } finally {
      setStageBusy(false);
    }
  }, []);

  const stageRunning = stageStatus.state === "running";

  const openConversation = useCallback((message?: string) => {
    const text = message?.trim();
    if (text) {
      setPendingHomeMessage({ id: Date.now(), text });
    }
    setActivePage("conversation");
  }, []);

  return (
    <div
      ref={shellRef}
      className={`app-shell app-shell--windowed ${activePage === "stage" ? "app-shell--home" : ""}`}
    >
      <TopNavigation
        activePage={activePage}
        onNavigate={setActivePage}
        stageRunning={stageRunning}
        live2dState={live2dState}
      />

      <main className="app-main">
        {activePage === "stage" ? (
          <StagePage
            status={stageStatus}
            busy={stageBusy}
            onStart={() => void runStageAction("start")}
            onStop={() => void runStageAction("stop")}
            onOpenConversation={() => openConversation()}
            onSendMessage={openConversation}
            onOpenMemory={() => setActivePage("memory")}
            onOpenSettings={() => setActivePage("settings")}
            onLive2DStateChange={setLive2dState}
          />
        ) : null}
        {activePage === "conversation" ? (
          <ConversationPage
            initialMessage={pendingHomeMessage}
            onInitialMessageConsumed={() => setPendingHomeMessage(null)}
          />
        ) : null}
        {activePage === "memory" ? <MemoryPage /> : null}
        {activePage === "world" ? <WorldPage /> : null}
        {activePage === "agent" ? <AgentPage /> : null}
        {activePage === "settings" ? <SettingsPage stageRunning={stageRunning} /> : null}
      </main>

      {activePage !== "stage" ? (
        <footer className="statusbar">
          <span><Database size={13} aria-hidden="true" /> NekoCore 待连接</span>
          <span><CloudOff size={13} aria-hidden="true" /> 云同步未配置</span>
          <span className="statusbar__spacer" />
          <span><ShieldCheck size={13} aria-hidden="true" /> 本地优先</span>
          <span className="statusbar__version">v0.1.0</span>
        </footer>
      ) : null}
    </div>
  );
}
