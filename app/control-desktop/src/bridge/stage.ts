import { invoke } from "@tauri-apps/api/core";

export type StageLifecycle =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "error";

export interface StageStatus {
  state: StageLifecycle;
  pid: number | null;
  message: string;
  simulated: boolean;
  updatedAt: string;
}

type RawStageStatus = Partial<{
  state: StageLifecycle | "not_running";
  running: boolean;
  pid: number | null;
  message: string;
  mode: string;
}>;

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

let browserStatus: StageStatus = {
  state: "stopped",
  pid: null,
  message: "浏览器预览模式",
  simulated: true,
  updatedAt: new Date().toISOString(),
};

const hasTauriRuntime = () =>
  typeof window !== "undefined" && window.__TAURI_INTERNALS__ !== undefined;

const wait = (duration: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, duration));

const normalizeStatus = (raw: RawStageStatus): StageStatus => {
  const state = raw.state === "not_running"
    ? "stopped"
    : raw.state ?? (raw.running ? "running" : "stopped");

  return {
    state,
    pid: typeof raw.pid === "number" ? raw.pid : null,
    message: raw.message ?? (state === "running" ? "桌宠舞台运行中" : "桌宠舞台已停止"),
    simulated: false,
    updatedAt: new Date().toISOString(),
  };
};

const updateBrowserStatus = (
  state: StageLifecycle,
  message: string,
): StageStatus => {
  browserStatus = {
    state,
    pid: state === "running" ? 2408 : null,
    message,
    simulated: true,
    updatedAt: new Date().toISOString(),
  };
  return browserStatus;
};

export async function getStageStatus(): Promise<StageStatus> {
  if (!hasTauriRuntime()) {
    return browserStatus;
  }

  const result = await invoke<RawStageStatus>("stage_status");
  return normalizeStatus(result);
}

export async function startStage(): Promise<StageStatus> {
  if (!hasTauriRuntime()) {
    updateBrowserStatus("starting", "正在启动浏览器预览舞台");
    await wait(360);
    return updateBrowserStatus("running", "浏览器预览舞台运行中");
  }

  const result = await invoke<RawStageStatus>("start_stage");
  return normalizeStatus(result);
}

export async function stopStage(): Promise<StageStatus> {
  if (!hasTauriRuntime()) {
    updateBrowserStatus("stopping", "正在停止浏览器预览舞台");
    await wait(260);
    return updateBrowserStatus("stopped", "浏览器预览舞台已停止");
  }

  const result = await invoke<RawStageStatus>("stop_stage");
  return normalizeStatus(result);
}
