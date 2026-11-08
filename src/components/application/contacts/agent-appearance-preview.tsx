import { useEffect, useRef, useState } from "react";
import type { ChatContact } from "@/app/contacts-store";
import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";
import { agentModelAsset } from "./agent-appearance-assets";
import { Live2DPreview } from "./live2d-preview";
import { loadLive2DRuntime } from "./live2d-runtime";

export interface AgentAppearancePreviewProps {
  contact: ChatContact;
  active?: boolean;
  className?: string;
  onAvatarClick?: () => void;
  avatarImporting?: boolean;
}

/** Real local character assets; unavailable models remain a clearly labelled avatar. */
export function AgentAppearancePreview(props: AgentAppearancePreviewProps) {
  return <AppearanceView key={props.contact.id} {...props} />;
}

function AppearanceView({ contact, active = true, className, onAvatarClick, avatarImporting = false }: AgentAppearancePreviewProps) {
  const modelAsset = agentModelAsset(contact);
  const [preferredMode, setMode] = useState<"model" | "avatar">("model");
  const mode = modelAsset ? preferredMode : "avatar";
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const preview = useRef<Live2DPreview | undefined>(undefined);
  const activeRef = useRef(active);
  activeRef.current = active;
  const modelUrl = mode === "model" ? modelAsset?.model : undefined;

  useEffect(() => {
    if (contact.avatarDataUrl) setMode("avatar");
  }, [contact.avatarDataUrl]);

  useEffect(() => setImageFailed(false), [contact.avatar]);

  useEffect(() => {
    if (!modelUrl || !canvas.current || !stage.current) return;
    let cancelled = false;
    const view = canvas.current;
    const container = stage.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: Live2DPreview | undefined;
    const syncActivity = () => renderer?.setActive(activeRef.current && document.visibilityState !== "hidden", reduced.matches);
    const fail = () => { if (!cancelled) { renderer?.destroy(); setStatus("error"); } };
    const resize = () => renderer?.resize(container.clientWidth, container.clientHeight);
    const observer = new ResizeObserver(resize);
    const contextLost = (event: Event) => { event.preventDefault(); fail(); };
    setStatus("loading");
    observer.observe(container);
    document.addEventListener("visibilitychange", syncActivity);
    reduced.addEventListener("change", syncActivity);
    view.addEventListener("webglcontextlost", contextLost);
    void loadLive2DRuntime().then(async (runtime) => {
      if (cancelled) return;
      renderer = new Live2DPreview(view, runtime, fail);
      preview.current = renderer;
      resize();
      syncActivity();
      await renderer.load(modelUrl);
      if (!cancelled) { setStatus("ready"); resize(); }
    }).catch(fail);
    return () => {
      cancelled = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncActivity);
      reduced.removeEventListener("change", syncActivity);
      view.removeEventListener("webglcontextlost", contextLost);
      renderer?.destroy();
      if (preview.current === renderer) preview.current = undefined;
    };
  }, [modelUrl, attempt]);

  useEffect(() => {
    preview.current?.setActive(active && document.visibilityState !== "hidden", window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, [active]);

  return <section aria-label={`${contact.name}的外观预览`} className={cx("flex shrink-0 flex-col gap-3", className)}>
    <div className="flex items-center justify-between gap-3">
      <span className="text-caption-1-medium text-text-secondary">外观预览</span>
      {modelAsset && <div role="group" aria-label="外观预览模式" className="flex rounded-lg bg-background-primary-default p-0.5">
        {([{ value: "model", label: "Live2D" }, { value: "avatar", label: "头像" }] as const).map((option) => <button key={option.value} type="button"
          aria-pressed={mode === option.value} onClick={() => setMode(option.value)}
          className={cx("rounded-md px-3 py-1 text-caption-1-medium outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring", mode === option.value ? "bg-background-full text-text-primary shadow-sm" : "text-text-secondary")}>{option.label}</button>)}
      </div>}
    </div>
    <div ref={stage} className="relative flex h-72 min-h-48 w-full items-center justify-center overflow-hidden rounded-xl bg-background-primary-default">
      {(mode === "avatar" || status !== "ready") && (contact.avatar && !imageFailed
        ? <img src={contact.avatar} alt={`${contact.name}的人物头像`} onError={() => setImageFailed(true)} className="h-full w-full object-contain p-4" />
        : <Avatar size="lg" color={contact.avatarColor} initials={Array.from(contact.name).slice(-1).join("")} alt={contact.name} className="size-28 text-5xl" />)}
      {mode === "avatar" && onAvatarClick && <button type="button" aria-label={contact.avatarDataUrl ? "更换联系人头像" : "导入联系人头像"}
        disabled={avatarImporting} onClick={onAvatarClick}
        className="absolute inset-0 cursor-pointer rounded-xl outline-none hover:bg-background-secondary-hover/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring disabled:cursor-wait" />}
      {mode === "model" && <canvas ref={canvas} role="img" aria-label={`${contact.name} Live2D 模型`}
        className={cx("absolute inset-0 block h-full w-full", status !== "ready" && "invisible")} />}
      {mode === "model" && status === "loading" && <p role="status" className="absolute inset-x-3 bottom-3 rounded-lg bg-background-full/95 px-3 py-2 text-center text-caption-1-regular text-text-secondary">正在加载 Live2D 模型…</p>}
      {mode === "model" && status === "error" && <div role="alert" className="absolute inset-x-3 bottom-3 rounded-lg bg-background-full/95 px-3 py-2 text-center text-caption-1-regular text-text-secondary">
        模型加载失败，已显示头像。<button type="button" className="ml-2 underline underline-offset-2" onClick={() => setAttempt((current) => current + 1)}>重新加载</button>
      </div>}
    </div>
    <p className="text-center text-caption-2-regular text-text-secondary">{mode === "model" ? `白羽澪 · Live2D ${modelAsset?.version}` : onAvatarClick ? "点击头像选择图片" : contact.avatar ? "人物头像" : "尚未配置人物头像与 Live2D 模型"}</p>
  </section>;
}
