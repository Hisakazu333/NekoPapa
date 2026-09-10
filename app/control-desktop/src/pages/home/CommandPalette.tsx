import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { npd } from "../../data/npd";
import { routeFor } from "../../lib/href";
import { IconChevronRight, IconSearch } from "../../components/icons";

interface PalItem {
  label: string;
  href: string;
  hint: string;
}

interface PalGroup {
  g: string;
  items: PalItem[];
}

/* ⌘P 面板数据：静态功能导航 + NPD 会话（无假计数），与原型 buildPalData 一致 */
function buildPalData(): PalGroup[] {
  const groups: PalGroup[] = [];
  const convs = npd.getConversations().map((c) => ({
    label: c.title,
    href: c.href || "chat.html",
    hint: c.running ? "运行中" : "",
  }));
  if (convs.length) groups.push({ g: "会话", items: convs });
  groups.push(
    {
      g: "学习",
      items: [
        { label: "学习计划", href: "plan.html", hint: "" },
        { label: "错题本", href: "mistakes.html", hint: "" },
        { label: "错题闪卡复习", href: "review.html", hint: "" },
        { label: "知识库", href: "lib.html", hint: "" },
        { label: "知识地图", href: "map.html", hint: "" },
        { label: "她的记忆", href: "memory.html", hint: "" },
        { label: "她的周报", href: "report.html", hint: "" },
      ],
    },
    {
      g: "操作",
      items: [
        { label: "新对话", href: "chat.html", hint: "⌘K" },
        { label: "交给 Neko（助手）", href: "assist-flow.html", hint: "" },
        { label: "进入专注模式", href: "focus.html", hint: "番茄钟" },
        { label: "使用统计", href: "settings.html#sec-usage", hint: "" },
        { label: "订阅管理", href: "subscribe.html", hint: "" },
        { label: "设置", href: "settings.html", hint: "⌘," },
        { label: "菜单栏下拉演示", href: "menubar.html", hint: "桌面原生" },
        { label: "截图提问演示", href: "shot-ask.html", hint: "⌘⇧2" },
      ],
    },
  );
  return groups;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);

  /* 打开时重置查询并聚焦输入框 */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSel(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return buildPalData()
      .map((g) => ({
        g: g.g,
        items: g.items.filter((i) => !q || (i.label + i.hint).toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const safeSel = Math.min(sel, Math.max(flatItems.length - 1, 0));

  const openItem = (item: PalItem) => {
    onClose();
    navigate(routeFor(item.href));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel(Math.min(safeSel + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel(Math.max(safeSel - 1, 0));
    } else if (e.key === "Enter" && flatItems[safeSel]) {
      openItem(flatItems[safeSel]);
    }
  };

  let flatIndex = -1;

  return (
    <div
      className={"palette-mask" + (open ? " show" : "")}
      id="paletteMask"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette">
        <div className="palette-input">
          <IconSearch size={15} />
          <input
            id="paletteInput"
            ref={inputRef}
            type="text"
            placeholder="搜索会话、功能、操作…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKeyDown}
          />
          <span className="np-kbd">esc</span>
        </div>
        <div className="palette-list np-scroll" id="paletteList">
          {groups.length === 0 ? (
            <div className="pal-group">没有找到匹配的，换个词试试</div>
          ) : (
            groups.map((g) => (
              <div key={g.g}>
                <div className="pal-group">{g.g}</div>
                {g.items.map((item) => {
                  flatIndex += 1;
                  const idx = flatIndex;
                  return (
                    <div
                      key={item.label}
                      className={"pal-item" + (idx === safeSel ? " sel" : "")}
                      onClick={() => openItem(item)}
                    >
                      <IconChevronRight size={13} />
                      <span>{item.label}</span>
                      {item.hint ? <span className="hint">{item.hint}</span> : null}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="palette-foot"><span>↑↓ 选择</span><span>↵ 打开</span><span>esc 关闭</span></div>
      </div>
    </div>
  );
}
