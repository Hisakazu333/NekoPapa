import { useCallback, useEffect, useState } from "react";
import { CloudOff, Database, ShieldCheck } from "lucide-react";
import { TopNavigation } from "./components/TopNavigation";
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

export default function App() {
  const [activePage, setActivePage] = useState<PageId>("stage");
  const [stageStatus, setStageStatus] = useState<StageStatus>(initialStageStatus);
  const [stageBusy, setStageBusy] = useState(false);

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

  return (
    <div className="app-shell">
      <TopNavigation
        activePage={activePage}
        onNavigate={setActivePage}
        stageRunning={stageRunning}
      />

      <main className="app-main">
        {activePage === "stage" ? (
          <StagePage
            status={stageStatus}
            busy={stageBusy}
            onStart={() => void runStageAction("start")}
            onStop={() => void runStageAction("stop")}
            onRefresh={() => void refreshStageStatus()}
            onOpenConversation={() => setActivePage("conversation")}
            onOpenSettings={() => setActivePage("settings")}
          />
        ) : null}
        {activePage === "conversation" ? <ConversationPage /> : null}
        {activePage === "memory" ? <MemoryPage /> : null}
        {activePage === "world" ? <WorldPage /> : null}
        {activePage === "agent" ? <AgentPage /> : null}
        {activePage === "settings" ? <SettingsPage stageRunning={stageRunning} /> : null}
      </main>

      <footer className="statusbar">
        <span><Database size={13} aria-hidden="true" /> NekoCore 待连接</span>
        <span><CloudOff size={13} aria-hidden="true" /> 云同步未配置</span>
        <span className="statusbar__spacer" />
        <span><ShieldCheck size={13} aria-hidden="true" /> 本地优先</span>
        <span className="statusbar__version">v0.1.0</span>
      </footer>
    </div>
  );
}
