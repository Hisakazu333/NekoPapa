import { useCallback, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ChevronDownIcon } from "@/components/foundations/icons/app-icons";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";

export function TranscriptViewport({ children, viewportRef, conversationId, busy, active = true, showLatest, className }: {
  children: ReactNode;
  viewportRef?: RefObject<HTMLDivElement | null>;
  conversationId: string;
  busy: boolean;
  active?: boolean;
  showLatest: boolean;
  className?: string;
}) {
  const internalRef = useRef<HTMLDivElement>(null);
  const viewport = viewportRef ?? internalRef;
  const content = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [following, setFollowing] = useState(true);
  const lastTop = useRef(0);
  const wasBusy = useRef(false);

  const setFollow = useCallback((next: boolean) => {
    if (follow.current === next) return;
    follow.current = next;
    setFollowing(next);
  }, []);
  const scrollToEnd = useCallback(() => {
    const pane = viewport.current;
    if (!pane?.clientHeight) return;
    pane.scrollTop = pane.scrollHeight;
    lastTop.current = pane.scrollTop;
  }, [viewport]);
  const jumpToLatest = useCallback(() => {
    setFollow(true);
    scrollToEnd();
  }, [setFollow, scrollToEnd]);

  useLayoutEffect(() => { jumpToLatest(); }, [conversationId, jumpToLatest]);
  useLayoutEffect(() => {
    if (busy && !wasBusy.current) jumpToLatest();
    wasBusy.current = busy;
  }, [busy, jumpToLatest]);

  useLayoutEffect(() => {
    const pane = viewport.current;
    const inner = content.current;
    if (!active || !pane || !inner) return;
    const followGrowth = () => { if (follow.current) scrollToEnd(); };
    followGrowth();
    const observer = new ResizeObserver(followGrowth);
    observer.observe(inner);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [active, scrollToEnd, viewport]);

  return <div className="relative flex min-h-0 flex-1 flex-col">
    <div ref={viewport} tabIndex={0} role="region" aria-label="聊天记录"
      className={cx("min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring", className)}
      onWheel={(event) => {
        if (event.deltaY < 0 && !event.ctrlKey && event.currentTarget.scrollTop > 0) setFollow(false);
      }}
      onScroll={(event) => {
        const pane = event.currentTarget;
        const top = pane.scrollTop;
        const atEnd = pane.scrollHeight - pane.clientHeight - top <= 2;
        if (top < lastTop.current && !atEnd) setFollow(false);
        if (top > lastTop.current && atEnd) setFollow(true);
        lastTop.current = top;
      }}>
      <div ref={content} className="flex min-h-full flex-col">{children}</div>
    </div>
    {showLatest && !following && <Button size="small" variant="secondary" leadingIcon={ChevronDownIcon}
      className="absolute bottom-2 start-1/2 z-1 -translate-x-1/2 rounded-full shadow-xs" onClick={jumpToLatest}>
      回到最新消息
    </Button>}
  </div>;
}
