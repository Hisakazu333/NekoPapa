import { useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/base/buttons/button";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { cx } from "@/utils/cx";
import { CabinControls, type CabinBackground } from "./cabin-controls";
import { cabinProgress, type CompanionProgress } from "./cabin-companions";
import { Live2DPreview, type CabinFraming } from "./live2d-preview";
import { loadLive2DRuntime } from "./live2d-runtime";
import { useAccountSession } from "../account/account-session";
import { isMacTauriWindow } from "../dashboard/mac-window-frame";
import { NativeCabinRenderer } from "./cabin-native-renderer";

interface PreparedModel extends CompanionProgress {
  name: string;
  mount: string;
  entry: string;
}

/** Only the authenticated host can issue this model handle. The signed OSS URL stays in Rust. */
export function CabinModelStage({ companionKey }: { companionKey: string | null }) {
  const { setProfile } = useAccountSession();
  const surface = useRef<HTMLElement>(null);
  const preview = useRef<Live2DPreview | NativeCabinRenderer>(null);
  const pressed = useRef<{ x: number; y: number }>(null);
  const useNative = isMacTauriWindow();
  const [attempt, setAttempt] = useState(0);
  const [model, setModel] = useState<PreparedModel>();
  const [status, setStatus] = useState("正在读取当前同伴并校验模型包…");
  const [error, setError] = useState("");
  const [motionError, setMotionError] = useState("");
  const [motionGroups, setMotionGroups] = useState<string[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [framing, setFraming] = useState<CabinFraming>("full");
  const [background, setBackground] = useState<CabinBackground>("light");
  const progress = model ? cabinProgress(model) : "";

  useEffect(() => { preview.current?.setFraming(framing); }, [framing, status]);

  useEffect(() => {
    const target = surface.current;
    const stage = target?.parentElement;
    if (!target || !stage) return;
    let live = true;
    let renderer: Live2DPreview | NativeCabinRenderer | undefined;
    setStatus(companionKey ? "正在准备同伴预览…" : "正在读取当前同伴并校验模型包…");
    setError("");
    setMotionError("");
    setMotionGroups([]);
    setModel(undefined);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => renderer?.resize(stage.clientWidth, stage.clientHeight);
    const activity = () => {
      setReducedMotion(reduced.matches);
      renderer?.setActive(document.visibilityState === "visible", reduced.matches);
    };
    const releasePointer = () => {
      if (renderer instanceof NativeCabinRenderer) renderer.releasePointer();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    window.addEventListener("resize", resize);
    window.addEventListener("blur", releasePointer);
    document.addEventListener("visibilitychange", activity);
    reduced.addEventListener("change", activity);
    const report = (failure: unknown) => {
      if (!live) return;
      setError(typeof failure === "string" ? failure : failure instanceof Error ? failure.message : "无法载入账号模型。");
      setStatus("");
    };
    void (async () => {
      const model = await invoke<PreparedModel>("account_cabin_prepare", { companionKey });
      if (!live) return;
      setModel(model);
      setStatus("正在显示模型…");
      if (useNative) {
        renderer = new NativeCabinRenderer(target, report);
      } else {
        const runtime = await loadLive2DRuntime();
        if (!live || !(target instanceof HTMLCanvasElement)) return;
        renderer = new Live2DPreview(target, runtime, report);
      }
      preview.current = renderer;
      resize();
      activity();
      const resource = useNative ? model.mount : convertFileSrc(model.mount, "nekocabin") + "/" + encodeURIComponent(model.entry);
      await renderer.load(resource);
      if (live) {
        setMotionGroups(renderer.motionGroups);
        setStatus("");
      }
    })().catch(async (failure: unknown) => {
      report(failure);
      if (!live) return;
      const snapshot = await invoke<{profile?: unknown}>("account_snapshot").catch(() => null);
      if (live && snapshot && !snapshot.profile) setProfile(undefined);
    });
    return () => {
      live = false;
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("blur", releasePointer);
      reduced.removeEventListener("change", activity);
      document.removeEventListener("visibilitychange", activity);
      preview.current = null;
      renderer?.destroy();
    };
  }, [attempt, companionKey, setProfile, useNative]);
  const play = async (motion: string) => {
    const active = preview.current;
    if (!active) return;
    setMotionError("");
    try {
      if (await active.playMotion(motion)) return;
    } catch { /* Failed actions leave the stage usable. */ }
    if (preview.current === active) setMotionError("这个动作没有播放，请再试一次。");
  };

  return <div className={cx("relative min-h-0 flex-1",
    background === "light" && "bg-[radial-gradient(ellipse_at_50%_37%,var(--color-background-full),transparent_72%)]")}>
    <div className="absolute inset-x-0 top-0 bottom-14">
      {useNative
        ? <div ref={(element) => { surface.current = element; }} role="img"
          aria-label={model?.name || "同伴模型"} className="absolute inset-0 size-full"
          onPointerMove={(event) => {
            const active = preview.current;
            if (event.pointerType === "mouse" && active instanceof NativeCabinRenderer)
              active.trackPointer(event.clientX, event.clientY);
          }}
          onPointerLeave={() => {
            const active = preview.current;
            if (active instanceof NativeCabinRenderer) active.releasePointer();
          }}
          onPointerDown={(event) => {
            pressed.current = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
          }}
          onPointerCancel={() => { pressed.current = null; }}
          onClick={(event) => {
            const origin = pressed.current;
            pressed.current = null;
            const active = preview.current;
            if (active instanceof NativeCabinRenderer && origin &&
              Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 8)
              active.tap(event.clientX, event.clientY);
          }} />
        : <canvas key={`${companionKey ?? "current"}:${attempt}`}
          ref={(element) => { surface.current = element; }}
          aria-label={model?.name || "同伴模型"} className="absolute inset-0 size-full" />}
    </div>
    {!status && !error && model && <div className="absolute inset-x-0 bottom-0 flex min-w-0 items-end justify-between gap-2 px-3 pb-3 sm:px-5 sm:pb-4">
      <div className="min-w-0">
        {companionKey && <p className="text-caption-1-medium text-text-secondary">预览中</p>}
        <h2 translate="no" className="truncate text-body-medium text-text-primary">{model.name}</h2>
        {progress && <p className="text-caption-1-regular text-text-secondary">{progress}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {motionError && <p role="alert" className="rounded-xl bg-background-primary-default p-2 text-caption-1-regular text-text-secondary">{motionError}</p>}
        <CabinControls motions={reducedMotion ? [] : motionGroups} framing={framing} background={background}
          onFraming={setFraming} onBackground={setBackground} onMotion={(motion) => void play(motion)} />
      </div>
    </div>}
    {(status || error) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-body-regular text-text-secondary">
      {!error && <SpinnerGlyph size="sm" />}
      <p role={error ? "alert" : "status"}>{error || status}</p>
      {error && <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>重试</Button>}
    </div>}
  </div>;
}
