import { Link, useLocation } from "react-router-dom";
import { IconLib } from "../components/icons";

/**
 * 共用占位页：原型中的其他页面（plan/chat/settings 等）按设计系统 2.0
 * 逐页重写，落地前统一路由到这里，保证导航可点击、不 404。
 */
export function PlaceholderPage() {
  const location = useLocation();
  return (
    <div className="placeholder-page">
      <div className="placeholder-card np-card">
        <span className="ic">
          <IconLib size={26} />
        </span>
        <h1>此页正在重写中</h1>
        <p>
          「{location.pathname}」按设计系统 2.0 重写中，
          <br />
          完成后会替换本占位页。
        </p>
        <Link className="np-btn ghost" to="/">
          返回首页
        </Link>
      </div>
    </div>
  );
}
