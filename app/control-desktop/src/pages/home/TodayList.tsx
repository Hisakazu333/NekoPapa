import { Link, useNavigate } from "react-router-dom";
import { useNpd } from "../../data/useNpd";
import { routeFor } from "../../lib/href";
import { IconCheck, TodayIcon } from "../../components/icons";

/** 今日学习列表：行点击跳转，勾选切换完成 */
export function TodayList() {
  const npd = useNpd();
  const navigate = useNavigate();
  const items = npd.getTodayPlan().items;

  return (
    <>
      <div className="sec-head">
        <h2>今日学习</h2>
        <Link to="/plan">查看全部 →</Link>
      </div>
      <div className="td-card" id="todayCard">
        <div id="todayList">
          {items.length === 0 ? (
            <div className="td-empty">
              今天还没有学习计划，<Link to="/plan">去计划页安排</Link>，或直接告诉她想学什么。
            </div>
          ) : (
            items.map((t) => (
              <div
                key={t.id}
                className="td-row"
                onClick={() => navigate(routeFor(t.href || "learn-flow.html"))}
              >
                <span className="td-ic">
                  <TodayIcon title={t.title} />
                </span>
                <span className="td-l">
                  <b>{t.title}</b>
                  {t.meta ? <i>{t.meta}</i> : null}
                </span>
                {t.durationMin ? <span className="td-min">{t.durationMin} 分钟</span> : null}
                <button
                  className={"td-check" + (t.done ? " done" : "")}
                  title={t.done ? "已完成" : "标记完成"}
                  onClick={(e) => {
                    e.stopPropagation();
                    npd.toggleTodayItem(t.id);
                  }}
                >
                  {t.done && <IconCheck size={10} />}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
