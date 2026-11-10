import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { GripHorizontalIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { IconButton } from "@/components/base/buttons/icon-button";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { Live2DPreview } from "@/components/application/contacts/live2d-preview";
import { loadLive2DRuntime } from "@/components/application/contacts/live2d-runtime";
import { desktopToolError, desktopTools, PET_WINDOW } from "@/app/desktop/desktop-tools";
import { cx } from "@/utils/cx";

export function DesktopPetWindow() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<HTMLButtonElement>(null);
  const player = useRef<Live2DPreview>(null);
  const motion = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const target = canvas.current;
    const stage = view.current;
    if (!target || !stage) return;
    let active = true;
    let renderer: Live2DPreview | undefined;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const activity = () => renderer?.setActive(document.visibilityState === "visible", reduced.matches);
    const resize = () => renderer?.resize(stage.clientWidth, stage.clientHeight);
    const report = (failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : desktopToolError(failure)); };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    document.addEventListener("visibilitychange", activity);
    reduced.addEventListener("change", activity);
    void Promise.all([desktopTools.petModel(), loadLive2DRuntime()]).then(async ([model, runtime]) => {
      if (!active) return;
      renderer = new Live2DPreview(target, runtime, report);
      player.current = renderer;
      motion.current = model.motion;
      resize();
      activity();
      await renderer.load(model.url);
      if (active) setLoaded(true);
    }).catch(report);
    return () => {
      active = false;
      observer.disconnect();
      document.removeEventListener("visibilitychange", activity);
      reduced.removeEventListener("change", activity);
      renderer?.destroy();
      player.current = null;
    };
  }, []);

  return <section aria-label="NekoPapa Live2D 桌宠" className="flex h-dvh flex-col gap-1 p-1.5">
    <div className="ms-auto flex items-center gap-0.5 rounded-xl border border-border-button-default bg-background-primary-default p-0.5 shadow-xs">
      <IconButton size="small" aria-label="拖动桌宠" icon={GripHorizontalIcon} className="cursor-grab"
        onPointerDown={(event) => { if (event.button === 0) void getCurrentWindow().startDragging().catch((failure) => setError(desktopToolError(failure))); }} />
      <IconButton size="small" aria-label="关闭桌宠" icon={XIcon}
        onClick={() => void desktopTools.close(PET_WINDOW).catch((failure) => setError(desktopToolError(failure)))} />
    </div>
    <button ref={view} type="button" aria-label="和桌宠互动"
      className={cx("relative min-h-0 flex-1 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring", loaded && "cursor-pointer")}
      onClick={() => {
        if (motion.current) void player.current?.playMotion(motion.current).catch(() => setError("无法播放此模型的动作。"));
      }}>
      <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
      {(!loaded || error) && <span role={error ? "alert" : "status"}
        className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-2 rounded-2xl bg-background-primary-default p-3 text-body-2-medium text-text-secondary">
        {!error && <SpinnerGlyph size="xs" />}{error || "正在加载 Live2D 模型…"}
      </span>}
    </button>
  </section>;
}
