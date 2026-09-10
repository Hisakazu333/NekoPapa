import { useEffect, useState } from "react";
import { isPreview } from "../../lib/env";
import { Sidebar } from "./Sidebar";
import { Titlebar } from "./Titlebar";
import { HerSuggestBanner } from "./HerSuggestBanner";
import { GreetRow } from "./GreetRow";
import { ContinueCard } from "./ContinueCard";
import { TodayList } from "./TodayList";
import { JourneyCard, RecentCard } from "./DashCards";
import { HerPanel } from "./HerPanel";
import { CommandPalette } from "./CommandPalette";
import { WelcomeModal } from "./WelcomeModal";

/**
 * 首页（设计系统 2.0 仪表盘）。
 * 布局默认铺满整个窗口（浏览器与 Tauri 宿主一致）；
 * 浏览器加 ?preview=1 时套用居中卡片预览外壳，用于对照原型页。
 */
export function HomePage() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(
    () => localStorage.getItem("np-side-collapsed") === "1",
  );

  const applySideCollapsed = (collapsed: boolean) => {
    setSideCollapsed(collapsed);
    localStorage.setItem("np-side-collapsed", collapsed ? "1" : "");
  };

  /* ---------- 全局快捷键 ----------
     ⌘B 收起/展开侧栏；⌘K 聚焦她的输入条；⌘P / ⌘⇧K 打开搜索面板；
     Escape 关闭面板（通知/引导的 Escape 由各组件自行处理）。 */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "b") {
        e.preventDefault();
        applySideCollapsed(!sideCollapsed);
      } else if (mod && key === "k" && !e.shiftKey) {
        e.preventDefault();
        document.getElementById("herTa")?.focus();
      } else if (mod && (key === "p" || (e.shiftKey && key === "k"))) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sideCollapsed]);

  return (
    <div className={"app-window" + (isPreview ? " preview" : "")}>
      <Sidebar
        collapsed={sideCollapsed}
        onCollapse={applySideCollapsed}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <section className="main">
        <Titlebar
          sideCollapsed={sideCollapsed}
          onExpandSidebar={() => applySideCollapsed(false)}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <div className="dash">
          {/* ============ 中央学习 dashboard ============ */}
          <div className="dash-center">
            <div className="dc-inner">
              <HerSuggestBanner />
              <GreetRow />
              <ContinueCard />
              <TodayList />
              <div className="dash-grid">
                <JourneyCard />
                <RecentCard />
              </div>
            </div>
          </div>

          {/* ============ 她面板 ============ */}
          <HerPanel />
        </div>
      </section>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <WelcomeModal />
    </div>
  );
}
