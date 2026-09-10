import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { npd } from "../../data/npd";
import { useNpd } from "../../data/useNpd";
import heroNekoUrl from "../../assets/hero-neko.png";
import {
  IconChatBubble,
  IconClock,
  IconImage,
  IconLib,
  IconMic,
  IconMore,
  IconSend,
  IconSparkleFill,
} from "../../components/icons";

const PLACEHOLDERS = [
  "问她点什么…",
  "比如：定语从句什么时候只能用 that？",
  "小技巧：输入 / 可以快速出题、拆解、复习",
];

/* ---------- 她的气泡：打字机 + 14s 换话，hover 暂停 ---------- */
function useTypewriter(lines: string[]) {
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const indexRef = useRef(0);
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearType = () => {
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    };
    const clearHold = () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
    const scheduleNext = () => {
      clearHold();
      holdTimerRef.current = setTimeout(nextLine, 14000);
    };
    const typeLine = (s: string) => {
      clearType();
      setText("");
      setTyping(true);
      let i = 0;
      typeTimerRef.current = setInterval(() => {
        i += 1;
        setText(s.slice(0, i));
        if (i >= s.length) {
          clearType();
          setTyping(false);
          scheduleNext();
        }
      }, 45);
    };
    const nextLine = () => {
      indexRef.current = (indexRef.current + 1) % lines.length;
      setOpacity(0);
      setTimeout(() => {
        setOpacity(1);
        typeLine(lines[indexRef.current]);
      }, 300);
    };

    const bubble = document.getElementById("nekoBubble");
    const onEnter = () => clearHold();
    const onLeave = () => scheduleNext();
    bubble?.addEventListener("mouseenter", onEnter);
    bubble?.addEventListener("mouseleave", onLeave);
    const startTimer = setTimeout(() => typeLine(lines[0]), 900);

    return () => {
      clearTimeout(startTimer);
      clearType();
      clearHold();
      bubble?.removeEventListener("mouseenter", onEnter);
      bubble?.removeEventListener("mouseleave", onLeave);
    };
    /* 文案在挂载时取一次，与原型一致 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { text, typing, opacity };
}

/** 她面板（右栏 · 264px）：头像、气泡、输入条、快捷动作、羁绊预览 */
export function HerPanel() {
  const data = useNpd();
  const navigate = useNavigate();

  /* 文案来自 NPD，无数据用中性问候 */
  const [lines] = useState(() => {
    const fromData = npd.getBubbleLines();
    return fromData.length ? fromData : ["我在呢。有问题随时说。"];
  });
  const bubble = useTypewriter(lines);

  /* ---------- 她的输入条 ---------- */
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [phIndex, setPhIndex] = useState(0);

  const autoGrow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 90) + "px";
  };

  /* placeholder 轮播（空且不聚焦时每 6s 换一句） */
  useEffect(() => {
    const timer = setInterval(() => {
      if (value || focused) return;
      setPhIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [value, focused]);

  const ready = !!value.trim();
  const goSend = () => {
    if (!value.trim()) {
      taRef.current?.focus();
      return;
    }
    navigate("/learn-flow");
  };

  /* ---------- 她推荐的 chips（有数据时浮在输入框上方） ---------- */
  const next = data.getNextUp();
  const mistakes = data.getMistakes();
  const chips: { fill: string; label: string }[] = [];
  if (next) chips.push({ fill: `接着上次的进度，把「${next.title}」收尾`, label: `${next.title} · 继续` });
  if (mistakes && mistakes.due > 0) chips.push({ fill: `把到期的 ${mistakes.due} 道错题带我复习一遍`, label: `错题 · 复习 ${mistakes.due} 道` });

  const fillChip = (fill: string) => {
    setValue(fill);
    taRef.current?.focus();
    requestAnimationFrame(autoGrow);
  };

  return (
    <aside className="her-panel">
      <div className="her-head">
        <span className="n">Neko</span>
        <span className="run-dot" title="在线"></span>
        <span className="st">在线</span>
        <button className="more" title="更多" onClick={() => navigate("/pet")}>
          <IconMore size={14} />
        </button>
      </div>

      <div className="her-art">
        <img src={heroNekoUrl} alt="Neko" />
      </div>

      <div className="her-bubble" id="nekoBubble" style={{ opacity: bubble.opacity }}>
        <span id="bubbleText" className={bubble.typing ? "typing" : undefined}>
          {bubble.text}
        </span>
      </div>

      <div className="her-composer" id="herComposer">
        {chips.length > 0 && (
          <div className="reco-chips" id="recoChips">
            {chips.map((c) => (
              <button key={c.label} onClick={() => fillChip(c.fill)}>
                <IconSparkleFill size={10} />
                {c.label}
              </button>
            ))}
          </div>
        )}
        <textarea
          id="herTa"
          ref={taRef}
          placeholder={PLACEHOLDERS[phIndex]}
          rows={1}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              goSend();
            }
          }}
        ></textarea>
        <div className="row">
          <button className="hc-btn" data-tip="语音输入">
            <IconMic size={13} />
          </button>
          <button className="hc-btn" data-tip="图片">
            <IconImage size={13} />
          </button>
          <span className="hc-hint">⏎ 发送</span>
          <button
            className={"send-btn" + (ready ? " ready" : "")}
            id="herSend"
            data-tip="发送"
            onClick={goSend}
          >
            <IconSend size={12} />
          </button>
        </div>
      </div>

      <div className="her-actions">
        <Link className="ha" to="/learn-flow">
          <IconLib size={15} />
          去练习
        </Link>
        <Link className="ha" to="/review">
          <IconClock size={15} />
          复习
        </Link>
        <Link className="ha" to="/chat">
          <IconChatBubble size={15} />
          聊天
        </Link>
      </div>

      <div className="her-bond">
        <div className="bond-row">
          羁绊 <b>Lv. 1</b>
          <span className="bond-bar"><i></i></span>
          <span className="preview-tag" title="羁绊/EXP/心情数据尚未接入，当前为静态预览">预览</span>
        </div>
        <div className="bond-cells">
          <div className="bc"><div className="l">今日</div><div className="v">+0 EXP</div></div>
          <div className="bc"><div className="l">心情</div><div className="v">平静</div></div>
        </div>
      </div>
    </aside>
  );
}
