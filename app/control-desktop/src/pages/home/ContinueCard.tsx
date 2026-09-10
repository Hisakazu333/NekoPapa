import { Link } from "react-router-dom";
import { useNpd } from "../../data/useNpd";
import { routeFor } from "../../lib/href";
import { IconArrowRight } from "../../components/icons";

/** 继续学习卡：下一项未完成计划 + 今日完成度；无数据 = 诚实空态 */
export function ContinueCard() {
  const npd = useNpd();
  const next = npd.getNextUp();
  const today = npd.getTodayPlan().items;
  const total = today.length;
  const doneN = today.filter((t) => t.done).length;

  if (!next) {
    return (
      <div id="continueCard">
        <div className="cc-card empty">
          <div>
            <div className="cc-empty-t">今天还没有安排学习</div>
            <div className="cc-empty-s">和她定一个小计划，25 分钟也算数</div>
          </div>
          <Link className="cc-plan" to="/plan">
            去安排
            <IconArrowRight size={11} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div id="continueCard">
      <Link className="cc-card" to={routeFor(next.href)}>
        <div className="cc-l">
          <span className="cc-tag">
            继续学习{next.durationMin ? ` · 约 ${next.durationMin} 分钟` : ""}
          </span>
          <span className="cc-t">{next.title}</span>
          {next.subtitle ? <span className="cc-s">{next.subtitle}</span> : null}
          {total ? (
            <div className="cc-prog">
              <span className="bar">
                <i style={{ width: `${(doneN / total) * 100}%` }}></i>
              </span>
              <span className="n">今日 {doneN}/{total}</span>
            </div>
          ) : null}
        </div>
        <span className="cc-go">
          继续
          <IconArrowRight size={13} />
        </span>
      </Link>
    </div>
  );
}
