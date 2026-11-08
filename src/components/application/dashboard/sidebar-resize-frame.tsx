import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ResizableDivider } from "@/components/base/resizable-divider/resizable-divider";
import { cx } from "@/utils/cx";
import { fitSidebarWidth, sidebarMaximumWidth, sidebarResizeState, SIDEBAR_COLLAPSED_WIDTH } from "./sidebar-layout";
import "./sidebar-resize-frame.css";

interface SidebarResizeFrameProps {
  enabled: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  className?: string;
  children: ReactNode;
}

/** Desktop geometry only; the sidebar retains navigation, search and account state. */
export function SidebarResizeFrame({ enabled, collapsed, onCollapsedChange, className, children }: SidebarResizeFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const frameId = useId();
  const [containerWidth, setContainerWidth] = useState(0);
  const [preferredWidth, setPreferredWidth] = useState<number | null>(null);
  const maximum = sidebarMaximumWidth(containerWidth);
  const expandedWidth = fitSidebarWidth(preferredWidth, maximum);
  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : expandedWidth;

  useEffect(() => {
    if (!enabled) return;
    const container = frameRef.current?.parentElement;
    if (!container) return;
    const measure = () => setContainerWidth(container.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [enabled]);

  const reset = () => {
    setPreferredWidth(null);
    onCollapsedChange(false);
  };

  const resize = (value: number | null) => {
    if (value === null) { reset(); return; }
    const next = sidebarResizeState(value, maximum);
    onCollapsedChange(next.collapsed);
    if (!next.collapsed) setPreferredWidth(next.width);
  };

  if (!enabled) return children;

  return <div ref={frameRef} id={frameId} className={cx("sidebar-resize-frame", className)} style={{ width }}
    onKeyDownCapture={(event) => {
      // A collapsed rail must also open in one keyboard step.
      if (!collapsed || event.key !== "ArrowRight" || !(event.target instanceof Element) || event.target.getAttribute("role") !== "separator") return;
      event.preventDefault();
      event.stopPropagation();
      onCollapsedChange(false);
    }}>
    {children}
    <ResizableDivider label="调整主侧栏宽度" direction="left" controls={frameId}
      value={width} min={SIDEBAR_COLLAPSED_WIDTH} max={maximum}
      preferredValue={collapsed ? SIDEBAR_COLLAPSED_WIDTH : preferredWidth}
      onResize={resize} onReset={reset} />
  </div>;
}
