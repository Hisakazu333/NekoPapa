import { useState } from "react";
import {
  Cat,
  ChevronRight,
  CircleGauge,
  MessageCircle,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Square,
} from "lucide-react";
import type { StageStatus } from "../bridge/stage";
import { IconButton } from "../components/ui";

const stageBackground = new URL(
  "../../../stage-desktop/qml/assets/home/home-stage-room-cat-pillow.png",
  import.meta.url,
).href;

const stateLabels: Record<StageStatus["state"], string> = {
  stopped: "已停止",
  starting: "启动中",
  running: "运行中",
  stopping: "停止中",
  error: "异常",
};

interface StagePageProps {
  status: StageStatus;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
  onOpenConversation: () => void;
  onOpenSettings: () => void;
}

export function StagePage({
  status,
  busy,
  onStart,
  onStop,
  onRefresh,
  onOpenConversation,
  onOpenSettings,
}: StagePageProps) {
  const [modelScale, setModelScale] = useState(92);
  const [stagePaused, setStagePaused] = useState(false);
  const running = status.state === "running";

  return (
    <div className="stage-page">
      <section className="stage-scene" style={{ backgroundImage: `url("${stageBackground}")` }}>
        <div className="stage-scene__veil" />

        <div className="stage-hud stage-hud--left">
          <span className={`status-dot ${running ? "status-dot--online" : ""}`} />
          <strong>{stateLabels[status.state]}</strong>
          <span className="hud-divider" />
          <span>{status.simulated ? "浏览器预览" : status.pid ? `PID ${status.pid}` : "原生 Stage"}</span>
        </div>

        <div className="stage-hud stage-hud--right">
          <IconButton label="刷新 Stage 状态" onClick={onRefresh} disabled={busy}>
            <RefreshCw size={16} aria-hidden="true" />
          </IconButton>
          <IconButton label="打开舞台设置" onClick={onOpenSettings}>
            <Settings2 size={16} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="live2d-placeholder" aria-label="Live2D 未配置">
          <span className="live2d-placeholder__ring" />
          <span className="live2d-placeholder__icon"><Cat size={36} strokeWidth={1.4} /></span>
          <strong>Live2D 未配置</strong>
          <span>等待模型资源与 Cubism Web 接入</span>
        </div>

        <div className="stage-composer">
          <button type="button" className="stage-composer__prompt" onClick={onOpenConversation}>
            <MessageCircle size={17} aria-hidden="true" />
            <span>与当前同伴对话</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <div className="stage-composer__actions">
            <IconButton
              label={stagePaused ? "继续舞台动画" : "暂停舞台动画"}
              onClick={() => setStagePaused((current) => !current)}
              disabled={!running}
            >
              {stagePaused ? <Play size={16} /> : <Pause size={16} />}
            </IconButton>
            {running ? (
              <button type="button" className="button button--danger-soft" onClick={onStop} disabled={busy}>
                <Square size={15} fill="currentColor" aria-hidden="true" />
                停止 Stage
              </button>
            ) : (
              <button type="button" className="button button--primary" onClick={onStart} disabled={busy}>
                <Play size={16} fill="currentColor" aria-hidden="true" />
                启动 Stage
              </button>
            )}
          </div>
        </div>
      </section>

      <aside className="stage-inspector">
        <div className="inspector-header">
          <div>
            <span className="eyebrow">桌宠舞台</span>
            <h2>运行检查器</h2>
          </div>
          <SlidersHorizontal size={17} aria-hidden="true" />
        </div>

        <section className="inspector-section">
          <h3>进程</h3>
          <dl className="property-list">
            <div><dt>状态</dt><dd className={`state-text state-text--${status.state}`}>{stateLabels[status.state]}</dd></div>
            <div><dt>渲染器</dt><dd>Native Cubism</dd></div>
            <div><dt>窗口</dt><dd>独立透明层</dd></div>
          </dl>
          <p className={`inline-notice ${status.state === "error" ? "inline-notice--error" : ""}`}>
            {status.message}
          </p>
        </section>

        <section className="inspector-section">
          <div className="section-title-row">
            <h3>模型变换</h3>
            <output>{modelScale}%</output>
          </div>
          <label className="range-field">
            <span>缩放</span>
            <input
              type="range"
              min="60"
              max="140"
              value={modelScale}
              onChange={(event) => setModelScale(Number(event.target.value))}
            />
          </label>
          <div className="coordinate-grid">
            <label>X <input type="number" defaultValue="0" /></label>
            <label>Y <input type="number" defaultValue="0" /></label>
          </div>
        </section>

        <section className="inspector-section inspector-section--grow">
          <h3>实时状态</h3>
          <div className="metric-empty">
            <CircleGauge size={20} aria-hidden="true" />
            <span>等待 NekoCore 状态流</span>
          </div>
          <div className="metric-grid">
            <span><small>P</small><strong>--</strong></span>
            <span><small>A</small><strong>--</strong></span>
            <span><small>D</small><strong>--</strong></span>
          </div>
        </section>

        <div className="inspector-footer">
          <Cat size={15} aria-hidden="true" />
          <span>模型参数保存在本机</span>
        </div>
      </aside>
    </div>
  );
}
