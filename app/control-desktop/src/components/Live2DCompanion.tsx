import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertTriangle, LoaderCircle, RotateCw } from "lucide-react";
import type { Live2DModel as PixiLive2DModel } from "pixi-live2d-display/cubism4";

const CORE_SCRIPT_URL = "/live2d/live2dcubismcore.min.js";
const MODEL_URL = "/live2d/hiyori/hiyori_pro_t11.model3.json";

let cubismCorePromise: Promise<void> | null = null;

declare global {
  interface Window {
    Live2DCubismCore?: unknown;
    PIXI?: typeof import("pixi.js");
  }
}

export type Live2DRenderState = "idle" | "loading" | "ready" | "error";

interface Live2DCompanionProps {
  className?: string;
  onStateChange?: (state: Live2DRenderState) => void;
}

function loadCubismCore() {
  if (window.Live2DCubismCore) return Promise.resolve();
  if (cubismCorePromise) return cubismCorePromise;

  cubismCorePromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CORE_SCRIPT_URL}"]`,
    );

    const attach = (script: HTMLScriptElement) => {
      const loaded = () => {
        script.dataset.live2dCoreState = "loaded";
        if (!window.Live2DCubismCore) {
          script.remove();
          reject(new Error("Cubism Core loaded without a runtime export"));
          return;
        }
        resolve();
      };
      const failed = () => {
        script.dataset.live2dCoreState = "failed";
        script.remove();
        reject(new Error("Cubism Core failed to load"));
      };

      script.addEventListener("load", loaded, { once: true });
      script.addEventListener("error", failed, { once: true });
    };

    if (existing?.dataset.live2dCoreState === "loading") {
      attach(existing);
      return;
    }
    existing?.remove();

    const script = document.createElement("script");
    script.src = CORE_SCRIPT_URL;
    script.async = true;
    script.dataset.live2dCoreState = "loading";
    attach(script);
    document.head.appendChild(script);
  }).catch((error) => {
    cubismCorePromise = null;
    throw error;
  });

  return cubismCorePromise;
}

function destroyLive2DModel(model: PixiLive2DModel) {
  const internalModel = (model as PixiLive2DModel & { internalModel?: unknown }).internalModel;
  if (!internalModel) {
    model.emit("destroy");
    model.removeAllListeners();
    return;
  }

  model.destroy({ children: true, texture: true, baseTexture: true });
}

export function Live2DCompanion({ className = "", onStateChange }: Live2DCompanionProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<PixiLive2DModel | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  const pointerFrameRef = useRef<number | null>(null);
  const pendingFocusRef = useRef<{ x: number; y: number } | null>(null);
  const [state, setState] = useState<Live2DRenderState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  onStateChangeRef.current = onStateChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let renderedWidth = 0;
    let renderedHeight = 0;
    let application: import("pixi.js").Application | null = null;
    const pendingModelRef: { current: PixiLive2DModel | null } = { current: null };

    const publishState = (nextState: Live2DRenderState) => {
      if (disposed) return;
      setState(nextState);
      onStateChangeRef.current?.(nextState);
    };

    publishState("loading");
    setErrorMessage("");
    host.replaceChildren();

    void (async () => {
      try {
        await loadCubismCore();
        const PIXI = await import("pixi.js");
        window.PIXI = PIXI;
        const { Live2DModel } = await import("pixi-live2d-display/cubism4");

        if (disposed) return;

        Live2DModel.registerTicker(PIXI.Ticker);
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        application = new PIXI.Application({
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });

        const canvas = application.view as HTMLCanvasElement;
        canvas.className = "home-live2d__canvas";
        canvas.setAttribute("aria-hidden", "true");
        host.appendChild(canvas);

        const model = await new Promise<PixiLive2DModel>((resolve, reject) => {
          const candidate = Live2DModel.fromSync(MODEL_URL, {
            autoUpdate: true,
            autoInteract: false,
            onLoad: () => resolve(candidate),
            onError: reject,
          });
          pendingModelRef.current = candidate;
        });

        if (disposed || !application) {
          destroyLive2DModel(model);
          pendingModelRef.current = null;
          return;
        }

        const modelWidth = model.internalModel.width;
        const modelHeight = model.internalModel.height;
        modelRef.current = model;
        application.stage.addChild(model);
        pendingModelRef.current = null;

        const applyLayout = () => {
          if (!application || disposed) return;
          const nextWidth = Math.max(1, host.clientWidth);
          const nextHeight = Math.max(1, host.clientHeight);
          if (nextWidth === renderedWidth && nextHeight === renderedHeight) return;

          renderedWidth = nextWidth;
          renderedHeight = nextHeight;
          application.renderer.resize(nextWidth, nextHeight);

          const scale = Math.min(
            (nextWidth * 1.06) / modelWidth,
            (nextHeight * 1.025) / modelHeight,
          );
          model.scale.set(scale);
          model.anchor.set(0.5, 1);
          model.x = nextWidth * 0.48;
          model.y = nextHeight * 1.03;
          application.renderer.render(application.stage);
        };

        applyLayout();
        const mobileMedia = window.matchMedia("(max-width: 840px)");
        if (mobileMedia.matches) {
          resizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(applyLayout);
          });
          resizeObserver.observe(host);
        }
        void model.motion("Idle", 0, 1);
        publishState("ready");
      } catch (error) {
        if (disposed) return;
        resizeObserver?.disconnect();
        resizeObserver = null;
        if (pendingModelRef.current) destroyLive2DModel(pendingModelRef.current);
        pendingModelRef.current = null;
        modelRef.current = null;
        application?.destroy(true, { children: true, texture: true, baseTexture: true });
        application = null;
        host.replaceChildren();
        const message = error instanceof Error ? error.message : String(error);
        setErrorMessage(message);
        publishState("error");
      }
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (pendingModelRef.current) destroyLive2DModel(pendingModelRef.current);
      pendingModelRef.current = null;
      modelRef.current = null;
      if (pointerFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = null;
      }
      pendingFocusRef.current = null;
      application?.destroy(true, { children: true, texture: true, baseTexture: true });
      application = null;
      host.replaceChildren();
      onStateChangeRef.current?.("idle");
    };
  }, [retryKey]);

  const pointerPosition = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scaleX = bounds.width > 0 ? event.currentTarget.clientWidth / bounds.width : 1;
    const scaleY = bounds.height > 0 ? event.currentTarget.clientHeight / bounds.height : 1;
    return {
      x: (event.clientX - bounds.left) * scaleX,
      y: (event.clientY - bounds.top) * scaleY,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!modelRef.current) return;
    pendingFocusRef.current = pointerPosition(event);
    if (pointerFrameRef.current !== null) return;

    pointerFrameRef.current = window.requestAnimationFrame(() => {
      pointerFrameRef.current = null;
      const model = modelRef.current;
      const focus = pendingFocusRef.current;
      if (model && focus) model.focus(focus.x, focus.y);
    });
  };

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    const model = modelRef.current;
    if (!model) return;
    model.focus(event.currentTarget.clientWidth / 2, event.currentTarget.clientHeight * 0.35);
  };

  const playTapMotion = (event?: PointerEvent<HTMLDivElement>) => {
    const model = modelRef.current;
    if (!model) return;

    if (event) {
      if (!event.isPrimary || event.button !== 0) return;
      const point = pointerPosition(event);
      if (!model.hitTest(point.x, point.y).includes("Body")) return;
    }
    void model.motion("Tap@Body", 0, 3);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    playTapMotion();
  };

  return (
    <div
      className={`home-live2d ${className}`.trim()}
      data-live2d-state={state}
      role={state === "ready" ? "button" : undefined}
      tabIndex={state === "ready" ? 0 : -1}
      aria-label="桃濑日和 Live2D 模型，点击与她互动"
      aria-busy={state === "loading"}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={playTapMotion}
      onKeyDown={handleKeyDown}
    >
      <div ref={hostRef} className="home-live2d__host" />

      {state === "loading" ? (
        <div className="home-live2d__status" role="status">
          <LoaderCircle size={19} aria-hidden="true" />
          <span>正在加载 Live2D</span>
        </div>
      ) : null}

      {state === "error" ? (
        <div className="home-live2d__status home-live2d__status--error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <strong>Live2D 加载失败</strong>
          <span title={errorMessage}>{errorMessage || "模型运行时未就绪"}</span>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}>
            <RotateCw size={14} aria-hidden="true" />重试
          </button>
        </div>
      ) : null}
    </div>
  );
}
