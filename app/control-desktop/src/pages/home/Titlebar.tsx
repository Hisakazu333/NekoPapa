import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useNpd } from "../../data/useNpd";
import { routeFor } from "../../lib/href";
import {
  IconBell,
  IconFocus,
  IconHome,
  IconSearch,
  IconSidebar,
  IconSpinner,
} from "../../components/icons";

export function Titlebar({
  sideCollapsed,
  onExpandSidebar,
  onOpenPalette,
}: {
  sideCollapsed: boolean;
  onExpandSidebar: () => void;
  onOpenPalette: () => void;
}) {
  const npd = useNpd();
  const navigate = useNavigate();

  /* ---------- 通知中心 ---------- */
  const [notifOpen, setNotifOpen] = useState(false);
  const bellWrapRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!notifOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (bellWrapRef.current && !bellWrapRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [notifOpen]);

  const notifications = npd.getNotifications();
  const tasks = npd.getRunningTasks();
  const hasUnread = notifications.some((n) => n.unread);

  return (
    <div className="titlebar">
      {sideCollapsed && (
        <button
          className="tb-btn side-expand"
          data-tip="展开侧栏 ⌘B"
          id="sideExpand"
          onClick={onExpandSidebar}
        >
          <IconSidebar size={14} />
        </button>
      )}
      <div className="tb-search" id="tbSearch" onClick={onOpenPalette}>
        <IconSearch size={13} />
        搜索课程、笔记，或直接问她…
        <span className="np-kbd">⌘P</span>
      </div>
      <span className="sp"></span>
      {tasks.length > 0 && (
        <div
          className="agent-pill"
          id="agentPill"
          data-tip="后台任务"
          onClick={() => navigate("/assist-flow")}
        >
          <IconSpinner className="spin" />
          <span id="agentPillText">
            {tasks[0].title + (tasks[0].meta ? " · " + tasks[0].meta : "")}
          </span>
        </div>
      )}
      <Link className="tb-btn hut" data-tip="她的小屋" to="/hut">
        <IconHome size={15} />
      </Link>
      <Link className="tb-btn" data-tip="专注模式" to="/focus">
        <IconFocus size={15} />
      </Link>
      <span className="bell-wrap" ref={bellWrapRef}>
        <button
          className="tb-btn"
          data-tip="通知"
          id="bellBtn"
          onClick={() => setNotifOpen((v) => !v)}
        >
          <IconBell size={15} />
          {hasUnread && <span className="bell-dot" id="bellDot"></span>}
        </button>
        <div className={"notif-panel" + (notifOpen ? " show" : "")} id="notifPanel">
          <div className="notif-head">
            通知
            {notifications.length > 0 && (
              <button
                id="readAllBtn"
                onClick={() => {
                  npd.markAllNotificationsRead();
                  setNotifOpen(false);
                }}
              >
                全部已读
              </button>
            )}
          </div>
          <div id="notifList">
            {notifications.length ? (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="notif-item"
                  onClick={() => n.href && navigate(routeFor(n.href))}
                >
                  <span className="ni">{n.icon || ""}</span>
                  <div>
                    <div className="nt">{n.title}</div>
                    <div className="nd">{n.desc || ""}</div>
                  </div>
                  {n.unread && <span className="unread"></span>}
                </div>
              ))
            ) : (
              <div className="notif-empty">没有新通知</div>
            )}
          </div>
        </div>
      </span>
    </div>
  );
}
