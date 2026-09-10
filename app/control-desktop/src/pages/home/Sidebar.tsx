import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useNpd } from "../../data/useNpd";
import { isTauri } from "../../lib/env";
import { routeFor } from "../../lib/href";
import iconUrl from "../../assets/icon.png";
import {
  IconBolt,
  IconChart,
  IconChevronDown,
  IconDevices,
  IconFlame,
  IconGear,
  IconHome,
  IconLib,
  IconLogout,
  IconMap,
  IconMemory,
  IconMistakes,
  IconMore,
  IconPlan,
  IconPlus,
  IconPlusBold,
  IconReport,
  IconSearch,
  IconSidebar,
  IconUser,
} from "../../components/icons";

/* ---------- 侧栏分组折叠（localStorage 记忆，键与原型一致） ---------- */
function useGroupCollapsed(grp: string): [boolean, () => void] {
  const key = "np-grp-collapsed-" + grp;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(key) === "1");
  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(key, next ? "1" : "");
      return next;
    });
  };
  return [collapsed, toggle];
}

/** 分组容器：折叠时隐藏组内条目（对应原型的兄弟节点隐藏逻辑） */
function NavGroup({ grp, label, tools, children }: {
  grp: string;
  label: string;
  tools?: (toggle: () => void) => React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, toggle] = useGroupCollapsed(grp);
  return (
    <div>
      <div className={"group-label" + (collapsed ? " collapsed" : "")} onClick={toggle}>
        {label}
        <span className="g-tools">
          {tools?.(toggle)}
          <IconChevronDown size={10} className="chev" />
        </span>
      </div>
      {!collapsed && children}
    </div>
  );
}

function NavItem({ href, icon, label, badge }: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
}) {
  const location = useLocation();
  const to = routeFor(href);
  const active = location.pathname === to;
  return (
    <Link className={"nav-item" + (active ? " active" : "")} to={to}>
      {icon}
      {label}
      {badge}
    </Link>
  );
}

const SIDE_MIN_W = 200;
const SIDE_MAX_W = 400;

export function Sidebar({
  collapsed,
  onCollapse,
  onOpenPalette,
}: {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  onOpenPalette: () => void;
}) {
  const npd = useNpd();
  const navigate = useNavigate();
  const asideRef = useRef<HTMLElement>(null);

  /* ---------- 侧栏拖拽调宽（200–400，localStorage 持久化） ---------- */
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem("np-side-w") ?? "", 10);
    return saved ? Math.min(SIDE_MAX_W, Math.max(SIDE_MIN_W, saved)) : null;
  });
  const [dragging, setDragging] = useState(false);

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const startX = e.clientX;
    const startW = asideRef.current?.offsetWidth ?? 252;
    const move = (ev: MouseEvent) => {
      setWidth(Math.min(SIDE_MAX_W, Math.max(SIDE_MIN_W, startW + ev.clientX - startX)));
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      setDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (asideRef.current) {
        localStorage.setItem("np-side-w", String(asideRef.current.offsetWidth));
      }
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  /* ---------- 账号菜单 ---------- */
  const [menuOpen, setMenuOpen] = useState(false);
  const footRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (footRef.current && !footRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpen]);

  /* ---------- NPD 数据 ---------- */
  const user = npd.getUser();
  const streak = npd.getStreak();
  const mistakes = npd.getMistakes();
  const today = npd.getTodayPlan().items;
  const weekDays = npd.getWeekPlan().days;
  const conversations = npd.getConversations();

  return (
    <aside
      ref={asideRef}
      className={"sidebar" + (collapsed ? " collapsed" : "")}
      style={width ? { width: `${width}px` } : undefined}
    >
      {/* 红绿灯行仅浏览器预览外壳渲染；Tauri 内使用原生标题栏 */}
      {!isTauri && (
        <div className="traffic">
          <span className="r"></span>
          <span className="y"></span>
          <span className="g"></span>
          <span className="side-toggle" data-tip="收起侧栏 ⌘B" onClick={() => onCollapse(true)}>
            <IconSidebar size={14} />
          </span>
        </div>
      )}

      <div className="brand">
        <img src={iconUrl} alt="NekoPapa" />
        <span className="n">NekoPapa</span>
      </div>

      <div className="side-actions">
        <button className="btn-new" id="btnNew" onClick={() => navigate("/chat")}>
          <IconPlus size={13} />
          新对话
          <span className="kbd np-kbd">⌘K</span>
        </button>
        <div className="side-search" id="sideSearch" onClick={onOpenPalette}>
          <IconSearch size={13} />
          搜索
          <span className="kbd np-kbd" style={{ marginLeft: "auto" }}>⌘P</span>
        </div>
      </div>

      <div className="side-scroll">
        <div>
          <NavItem href="index.html" icon={<IconHome />} label="首页" />
          <NavGroup grp="learn" label="学习">
            <NavItem
              href="plan.html"
              icon={<IconPlan />}
              label="学习计划"
              badge={
                today.length ? (
                  <span className="cnt" id="planCnt">
                    {today.filter((t) => t.done).length}/{today.length}
                  </span>
                ) : undefined
              }
            />
            <NavItem
              href="mistakes.html"
              icon={<IconMistakes />}
              label="错题本"
              badge={
                mistakes && mistakes.due > 0 ? (
                  <span className="cnt hot" id="mistakeCnt">{mistakes.due}</span>
                ) : undefined
              }
            />
            <NavItem href="lib.html" icon={<IconLib />} label="知识库" />
            <NavItem href="map.html" icon={<IconMap />} label="知识地图" />
            <NavItem href="report.html" icon={<IconReport />} label="她的周报" />
            <NavItem href="memory.html" icon={<IconMemory />} label="她的记忆" />
          </NavGroup>

          <NavGroup grp="link" label="互联">
            <NavItem href="assist-flow.html" icon={<IconBolt />} label="交给 Neko" />
            <NavItem href="drop.html" icon={<IconDevices />} label="设备互联" />
          </NavGroup>

          <NavGroup
            grp="conv"
            label="对话"
            tools={() => (
              <button
                className="g-add"
                id="convAdd"
                title="新对话"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/chat");
                }}
              >
                <IconPlusBold size={11} />
              </button>
            )}
          >
            <div id="convList">
              {conversations.length ? (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    className="conv"
                    onClick={() => c.href && navigate(routeFor(c.href))}
                  >
                    {c.title}
                    {c.running && <span className="run-dot"></span>}
                    <button
                      className="more"
                      title="更多操作"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconMore size={13} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="side-empty">还没有对话</div>
              )}
            </div>
          </NavGroup>
        </div>
      </div>

      {/* 连续学习卡：她的陪伴计数 */}
      <div className="streak-card" id="streakCard">
        <div className="sc-row">
          <IconFlame size={13} />
          <span className="n" id="streakText">
            {streak != null ? (
              <>
                连续 <b>{streak}</b> 天
              </>
            ) : (
              "连续记录"
            )}
          </span>
        </div>
        <div className="sc-bars" id="streakBars">
          {weekDays.map((d) => {
            const lvl = Math.min(d.blocks.length, 4);
            const cls = d.isToday && lvl ? "today" : lvl ? "on" : "";
            const ht = lvl ? 24 + lvl * 19 : 0;
            return (
              <div key={d.name} className={"d " + cls}>
                <i style={lvl ? { height: `${ht}%` } : undefined}></i>
                <span>{d.name.slice(1)}</span>
              </div>
            );
          })}
        </div>
        {streak == null && (
          <div className="sc-empty" id="streakEmpty">还没有连续记录，今天开始第一天。</div>
        )}
      </div>

      <div className="side-foot" ref={footRef}>
        <div
          className={"foot-user" + (menuOpen ? " open" : "")}
          id="accountBtn"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="avatar" id="footAvatar">
            {user?.name ? user.name.slice(0, 1).toUpperCase() : "·"}
          </span>
          <span className="n" id="footName">{user?.name ?? "未登录"}</span>
          <span className="plan" id="footPlan" hidden>PRO</span>
          <span className="foot-icons">
            <button
              title="设置"
              id="gearBtn"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/settings");
              }}
            >
              <IconGear size={14} />
            </button>
          </span>
        </div>
        <div className={"account-menu" + (menuOpen ? " show" : "")} id="accountMenu">
          <div className="menu-item" onClick={() => navigate("/settings#sec-account")}>
            <IconUser size={14} />
            个人资料
          </div>
          <div className="menu-item" onClick={() => navigate("/settings#sec-usage")}>
            <IconChart size={14} />
            使用统计
          </div>
          <div className="menu-item" onClick={() => navigate("/subscribe")}>
            <IconBolt size={14} />
            管理订阅
            <span className="np-badge">Pro</span>
          </div>
          <div className="menu-divider"></div>
          <div className="menu-item danger">
            <IconLogout size={14} />
            退出登录
          </div>
        </div>
      </div>
      <span
        className={"side-drag" + (dragging ? " on" : "")}
        id="sideDrag"
        title="拖动调整侧栏宽度"
        onMouseDown={onDragStart}
      ></span>
    </aside>
  );
}
