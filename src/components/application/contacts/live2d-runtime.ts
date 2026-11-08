import type { Live2DRuntime } from "./live2d-types";

type RuntimeWindow = Window & { PIXI?: Live2DRuntime; Live2DCubismCore?: unknown };
let pending: Promise<Live2DRuntime> | undefined;

function loadScript(source: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      if (error) { script.remove(); reject(error); } else resolve();
    };
    const timeout = window.setTimeout(() => finish(new Error("Live2D 运行库加载超时。")), 20_000);
    script.src = source;
    script.async = false;
    script.onload = () => finish();
    script.onerror = () => finish(new Error("Live2D 运行库加载失败。"));
    document.head.appendChild(script);
  });
}

/** Shared script loading is lazy; the model and WebGL context remain view-owned. */
export function loadLive2DRuntime(): Promise<Live2DRuntime> {
  if (pending) return pending;
  const runtimeWindow = window as RuntimeWindow;
  pending = (async () => {
    if (!runtimeWindow.Live2DCubismCore) await loadScript("/vendor/live2d/live2dcubismcore.min.js");
    if (!runtimeWindow.PIXI) await loadScript("/vendor/live2d/pixi.min.js");
    if (!runtimeWindow.PIXI?.live2d) await loadScript("/vendor/live2d/cubism4.min.js");
    if (!runtimeWindow.PIXI?.live2d || !runtimeWindow.Live2DCubismCore) throw new Error("Live2D 运行库未就绪。");
    runtimeWindow.PIXI.utils.skipHello();
    return runtimeWindow.PIXI;
  })().catch((error: unknown) => { pending = undefined; throw error; });
  return pending;
}
