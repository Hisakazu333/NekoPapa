import { useNpd } from "../../data/useNpd";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

/** 问候行：左时段问候 + 日期，右她的一句话 */
export function GreetRow() {
  const npd = useNpd();
  const now = new Date();
  const h = now.getHours();
  const g = h < 6 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : h < 23 ? "晚上好" : "夜深了";
  const user = npd.getUser();

  return (
    <div className="greet-row">
      <div>
        <h1 id="greet">{user && user.name ? `${g}，${user.name}` : g}</h1>
        <div className="greet-date" id="greetDate">
          {`${now.getMonth() + 1}月${now.getDate()}日 · 周${WEEK[now.getDay()]}`}
        </div>
      </div>
      <div className="her-quote">
        <span className="q">「<em>継続</em>は、きっと力になる。」</span>
        <small>每天进步一点点</small>
      </div>
    </div>
  );
}
