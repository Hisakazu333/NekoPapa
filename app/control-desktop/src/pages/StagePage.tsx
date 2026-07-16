import { type FormEvent, useState } from "react";
import {
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  CloudSun,
  HeartPulse,
  MessageCircle,
  Power,
  RefreshCw,
  Send,
  Smile,
} from "lucide-react";
import {
  Live2DCompanion,
  type Live2DRenderState,
} from "../components/Live2DCompanion";
import type { StageStatus } from "../bridge/stage";

const stageBackground = new URL(
  "../assets/home-stage-room-cat-pillow.png",
  import.meta.url,
).href;

const schedules = [
  { id: "reading", time: "22:00", title: "阅读计划", detail: "《小王子》第 3 章" },
  { id: "rest", time: "23:30", title: "休息提醒", detail: "准备休息啦～" },
];

interface StagePageProps {
  status: StageStatus;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  onOpenConversation: () => void;
  onSendMessage: (message: string) => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  onLive2DStateChange: (state: Live2DRenderState) => void;
}

interface MeterProps {
  label: string;
  value: number;
  tone: "green" | "rose" | "amber";
}

function Meter({ label, value, tone }: MeterProps) {
  return (
    <div className="home-meter">
      <div><span>{label}</span><strong>{value}%</strong></div>
      <span
        className="home-meter__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <i className={`home-meter__fill home-meter__fill--${tone}`} style={{ width: `${value}%` }} />
      </span>
    </div>
  );
}

function getGreeting(now: Date) {
  const hour = now.getHours();

  if (hour < 6) return { title: "夜深了... Lumia", detail: "我有点无聊... 陪你聊聊天吗？" };
  if (hour < 11) return { title: "早上好，Lumia", detail: "窗边的阳光刚刚好，一起开始今天吧。" };
  if (hour < 14) return { title: "中午好，Lumia", detail: "别忘了给自己留一点休息时间。" };
  if (hour < 18) return { title: "下午好，Lumia", detail: "她正在窗边安静地陪着你。" };
  return { title: "晚上好，Lumia", detail: "今天也辛苦了，慢慢放松下来吧。" };
}

export function StagePage({
  status,
  busy,
  onStart,
  onStop,
  onOpenConversation,
  onSendMessage,
  onOpenMemory,
  onOpenSettings,
  onLive2DStateChange,
}: StagePageProps) {
  const [draft, setDraft] = useState("");
  const [completedSchedules, setCompletedSchedules] = useState<Set<string>>(() => new Set());
  const now = new Date();
  const dateText = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);
  const greeting = getGreeting(now);
  const stageOnline = status.state === "running";
  const remainingSchedules = schedules.length - completedSchedules.size;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;

    setDraft("");
    onSendMessage(message);
  };

  const toggleSchedule = (id: string) => {
    setCompletedSchedules((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="home-page">
      <section
        className="home-scene"
        style={{ backgroundImage: `url("${stageBackground}")` }}
        aria-label="桃濑日和的小屋"
      >
        <div className="home-scene__wash" />

        <div className="home-layout">
          <aside className="home-stack home-stack--left" aria-label="同伴状态">
            <article className="home-card home-greeting">
              <div className="home-card__meta"><CloudSun size={17} />{dateText}</div>
              <h1>{greeting.title}</h1>
              <p>{greeting.detail}</p>
            </article>

            <article className="home-card home-vitals">
              <div className="home-card__heading"><h2>身体状态</h2></div>
              <Meter label="饱食" value={84} tone="green" />
              <Meter label="水分" value={94} tone="rose" />
              <Meter label="活力" value={75} tone="amber" />
            </article>

            <article className="home-card home-rhythm">
              <h2>关系节奏</h2>
              <div><span>记忆数</span><strong>5</strong></div>
              <div><span>今日互动</span><strong>12</strong></div>
            </article>
          </aside>

          <div className="home-character-stage">
            <Live2DCompanion onStateChange={onLive2DStateChange} />
          </div>

          <aside className="home-stack home-stack--actions" aria-label="小屋操作">
            <article className="home-card home-current">
              <h2>当日信息</h2>
              <strong>她应该是桌面上<br />一直陪着你的主角。</strong>
              <p>当前由 Live2D 舞台为中心，实时响应互动、情感模拟和输入对话。</p>
            </article>

            <article className="home-card home-quick-actions">
              <h2>快捷动作</h2>
              <button type="button" onClick={onOpenConversation}>
                  <MessageCircle size={18} /><span><strong>去对话</strong><small>和日和聊一会儿</small></span><ChevronRight size={16} />
              </button>
              <button type="button" onClick={onOpenMemory}>
                <Bookmark size={18} /><span><strong>看记忆</strong><small>查看近期事件轨迹</small></span><ChevronRight size={16} />
              </button>
              <button type="button" onClick={onOpenSettings}>
                <RefreshCw size={18} /><span><strong>同步设置</strong><small>连接手机或远端</small></span><ChevronRight size={16} />
              </button>
            </article>
          </aside>

          <aside className="home-stack home-stack--right" aria-label="今日信息">
            <article className="home-card home-weather">
              <div className="home-card__heading"><h2>查看天气</h2></div>
              <p>上海市 浦东新区</p>
              <div className="home-weather__reading">
                <CloudSun size={32} />
                <strong>23°C</strong>
                <span>多云</span>
              </div>
              <p className="home-weather__inline-facts">湿度 60% <i /> 东南风 2级</p>
              <p className="home-weather__air">空气质量：良</p>
              <p className="home-weather__source">数据来源：和风天气</p>
              <p className="home-weather__forecast">预计转晴：5-8 秒</p>
            </article>

            <article className="home-card home-schedule">
              <div className="home-card__heading">
                <h2>今日日程</h2>
                <span>剩余 {remainingSchedules} 项</span>
              </div>
              {schedules.map((item) => {
                const completed = completedSchedules.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`home-schedule__item ${completed ? "is-complete" : ""}`}
                    aria-pressed={completed}
                    onClick={() => toggleSchedule(item.id)}
                  >
                    <i>{completed ? <Check size={11} aria-hidden="true" /> : null}</i>
                    <time>{item.time}</time>
                    <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                  </button>
                );
              })}
            </article>
          </aside>
        </div>

        <div className="home-mobile-summary" aria-label="小屋摘要">
          <span><HeartPulse size={15} /><strong>84%</strong><small>饱食</small></span>
          <span><CloudSun size={15} /><strong>23°</strong><small>多云</small></span>
          <span><CalendarDays size={15} /><strong>{remainingSchedules}</strong><small>日程</small></span>
          <button
            type="button"
            className={stageOnline ? "is-online" : ""}
            onClick={stageOnline ? onStop : onStart}
            disabled={busy}
            aria-label={stageOnline ? "停止桌面舞台" : "启动桌面舞台"}
            title={stageOnline ? "停止桌面舞台" : "启动桌面舞台"}
          ><Power size={16} /><small>桌面</small></button>
        </div>

        <form className="home-composer" onSubmit={submit}>
          <div className="home-composer__field">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="跟 Lumia 说点什么..."
              aria-label="跟 Lumia 说点什么"
            />
            <button
              type="button"
              className="home-composer__mood"
              aria-label="添加表情"
              title="添加表情"
              onClick={() => setDraft((current) => current ? `${current} :)` : ":)")}
            >
              <Smile size={18} aria-hidden="true" />
            </button>
          </div>
          <button type="submit" aria-label="发送消息" title="发送消息" disabled={!draft.trim()}>
            <Send size={21} aria-hidden="true" />
          </button>
        </form>
      </section>
    </div>
  );
}
