import { Link, useNavigate } from "react-router-dom";
import { useNpd } from "../../data/useNpd";
import { routeFor } from "../../lib/href";
import { IconChevronRight } from "../../components/icons";

/** 学习足迹：本周 7 格，学过的日子点亮 */
export function JourneyCard() {
  const npd = useNpd();
  const days = npd.getWeekPlan().days;
  const learned = days.filter((d) => d.blocks.length).length;

  return (
    <div className="d-card">
      <h3>
        学习足迹 <Link to="/report">周报 →</Link>
      </h3>
      <div className="week-bars" id="journeyBars">
        {days.map((d) => {
          const lvl = Math.min(d.blocks.length, 4);
          const cls = d.isToday && lvl ? "today" : lvl ? "on" : "";
          const ht = lvl ? 20 + lvl * 20 : 0;
          return (
            <div key={d.name} className={"d " + cls} title={`${d.name} ${d.month}/${d.date}`}>
              <i style={lvl ? { height: `${ht}%` } : undefined}></i>
              <span>{d.name.slice(1)}</span>
            </div>
          );
        })}
      </div>
      <div className="week-hint" id="journeyHint">
        {learned ? `这一周有 ${learned} 天学过，继续保持。` : "这一周还没有记录，今天学一点就点亮。"}
      </div>
    </div>
  );
}

/** 最近会话 */
export function RecentCard() {
  const npd = useNpd();
  const navigate = useNavigate();
  const convs = npd.getConversations().slice(0, 4);

  return (
    <div className="d-card">
      <h3>
        最近 <Link to="/chat">全部 →</Link>
      </h3>
      <div id="recentList">
        {convs.length === 0 ? (
          <div className="re-empty">还没有对话记录</div>
        ) : (
          convs.map((c) => (
            <div
              key={c.id}
              className="re-row"
              onClick={() => navigate(routeFor(c.href || "chat.html"))}
            >
              {c.running && <span className="run-dot"></span>}
              <span className="t">{c.title}</span>
              <IconChevronRight size={11} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
