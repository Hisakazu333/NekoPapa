import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import iconUrl from "../../assets/icon.png";
import {
  IconClose,
  IconFlame,
  IconLib,
  IconSmile,
} from "../../components/icons";

/** 新手引导：首次启动 / #welcome；关闭后写 localStorage np-onboarded */
export function WelcomeModal() {
  const location = useLocation();
  const [show, setShow] = useState(
    () => location.hash === "#welcome" || !localStorage.getItem("np-onboarded"),
  );

  /* 打开期间支持 Escape 关闭（对应原型全局 Escape 行为） */
  useEffect(() => {
    if (!show) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const dismiss = () => {
    localStorage.setItem("np-onboarded", "1");
    setShow(false);
    if (location.hash === "#welcome") {
      history.replaceState(null, "", location.pathname + location.search);
    }
  };

  return (
    <div
      className={"welcome-mask" + (show ? " show" : "")}
      id="welcomeMask"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="welcome">
        <button className="w-close" id="welcomeClose" title="跳过引导" onClick={dismiss}>
          <IconClose size={12} />
        </button>
        <img src={iconUrl} alt="Neko" />
        <h2>我是 Neko，你的同桌</h2>
        <p>
          不是工具，是陪你把学习这件事坚持下去的那个她。<br />三件事让你快速认识我：
        </p>
        <div className="feats">
          <div className="feat">
            <span className="fi"><IconLib size={13} /></span>
            <div><b>每天打开就有方向</b><br />我会接上前天的进度，告诉你今天 25 分钟能学完什么</div>
          </div>
          <div className="feat">
            <span className="fi"><IconFlame size={13} /></span>
            <div><b>错的我都记着</b><br />错题、没懂的知识点，我会按遗忘曲线挑最好的时机找你复习</div>
          </div>
          <div className="feat">
            <span className="fi"><IconSmile size={13} /></span>
            <div><b>我还能住在桌面上</b><br />设置里开启「桌宠形态」，写代码的时候我也在</div>
          </div>
        </div>
        <button className="np-btn primary" style={{ width: "100%", height: "38px" }} id="welcomeGo" onClick={dismiss}>
          开始今天的学习
        </button>
      </div>
    </div>
  );
}
