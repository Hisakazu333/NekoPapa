import { useState } from "react";
import { useNpd } from "../../data/useNpd";
import { IconClose, IconSparkleFill } from "../../components/icons";

/** 她的智能建议横幅：仅当 NPD.getHerSuggestion() 有值时渲染 */
export function HerSuggestBanner() {
  const npd = useNpd();
  const [bye, setBye] = useState(false);
  const suggestion = npd.getHerSuggestion();
  if (!suggestion) return null;

  const dismiss = () => {
    if (bye) return;
    setBye(true);
    /* 淡出动画结束后再移除数据（对应原型 .bye → 320ms 后 remove） */
    setTimeout(() => npd.dismissSuggestion(), 320);
  };

  return (
    <div className={"her-suggest" + (bye ? " bye" : "")} id="herSuggest">
      <span className="hs-ic">
        <IconSparkleFill size={12} />
      </span>
      {/* 建议文案允许少量内联标记（<b>），来自数据层受控内容 */}
      <span className="hs-t" id="hsText" dangerouslySetInnerHTML={{ __html: suggestion.text }}></span>
      <button className="hs-yes" id="hsYes" onClick={dismiss}>
        {suggestion.actionText || "好"}
      </button>
      <button className="hs-no" id="hsNo" title="忽略" onClick={dismiss}>
        <IconClose size={11} />
      </button>
    </div>
  );
}
