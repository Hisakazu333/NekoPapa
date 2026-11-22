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

interface PreparedModel extends CompanionProgress {
  name: string;
  mount: string;
  entry: string;
}

/** Only the authenticated host can issue this model handle. The signed OSS URL stays in Rust. */
export function CabinModelStage({ companionKey }: { companionKey: string | null }) {
  const { setProfile } = useAccountSession();
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<Live2DPreview>(null);
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
    const target = canvas.current;
    const stage = target?.parentElement;
    if (!target || !stage) return;
    let live = true;
    let renderer: Live2DPreview | undefined;
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
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
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
      const runtime = await loadLive2DRuntime();
      if (!live) return;
      renderer = new Live2DPreview(target, runtime, report);
      preview.current = renderer;
      resize();
      activity();
      await renderer.load(convertFileSrc(model.mount, "nekocabin") + "/" + encodeURIComponent(model.entry));
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
      reduced.removeEventListener("change", activity);
      document.removeEventListener("visibilitychange", activity);
      preview.current = null;
      renderer?.destroy();
    };
  }, [attempt, companionKey, setProfile]);
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
      <canvas key={`${companionKey ?? "current"}:${attempt}`} ref={canvas}
        aria-label={model?.name || "同伴模型"} className="absolute inset-0 size-full" />
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
