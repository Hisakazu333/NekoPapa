import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Brain,
  Cat,
  Globe2,
  MessageCircle,
  Settings,
  Sparkles,
} from "lucide-react";
import type { PageId } from "../App";

interface NavigationItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
}

const navigationItems: NavigationItem[] = [
  { id: "stage", label: "舞台", icon: Sparkles },
  { id: "conversation", label: "对话", icon: MessageCircle },
  { id: "memory", label: "记忆", icon: Brain },
  { id: "world", label: "世界", icon: Globe2 },
  { id: "agent", label: "Agent", icon: Bot },
  { id: "settings", label: "设置", icon: Settings },
];

interface TopNavigationProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  stageRunning: boolean;
}

export function TopNavigation({ activePage, onNavigate, stageRunning }: TopNavigationProps) {
  return (
    <header className="topbar">
      <button className="brand" type="button" onClick={() => onNavigate("stage")}>
        <span className="brand__mark"><Cat size={18} aria-hidden="true" /></span>
        <span className="brand__copy">
          <strong>OpenNeko</strong>
          <small>Engine</small>
        </span>
      </button>

      <nav className="topnav" aria-label="主导航">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = item.id === activePage;
          return (
            <button
              key={item.id}
              type="button"
              className={`topnav__item ${active ? "topnav__item--active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="topbar__status" title={stageRunning ? "桌宠舞台运行中" : "桌宠舞台未运行"}>
        <span className={`status-dot ${stageRunning ? "status-dot--online" : ""}`} />
        <span>{stageRunning ? "Stage 在线" : "Stage 离线"}</span>
      </div>
    </header>
  );
}
