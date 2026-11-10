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
    pane.scrollTo({ top: pane.scrollHeight, behavior: "instant" });
    lastTop.current = pane.scrollTop;
  }, [viewport]);
  const jumpToLatest = useCallback(() => {
    setFollow(true);
    scrollToEnd();
  }, [setFollow, scrollToEnd]);

  useLayoutEffect(() => {
    if (showLatest) jumpToLatest();
    else {
      viewport.current?.scrollTo({ top: 0, behavior: "instant" });
      lastTop.current = 0;
      setFollow(true);
    }
  }, [conversationId, jumpToLatest, setFollow, showLatest, viewport]);
  useLayoutEffect(() => {
    if (busy && !wasBusy.current) jumpToLatest();
    wasBusy.current = busy;
  }, [busy, jumpToLatest]);

  useLayoutEffect(() => {
    const pane = viewport.current;
    const inner = content.current;
    if (!active || !showLatest || !pane || !inner) return;
    const followGrowth = () => { if (follow.current) scrollToEnd(); };
    followGrowth();
    const observer = new ResizeObserver(followGrowth);
    observer.observe(inner);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [active, scrollToEnd, showLatest, viewport]);

  return <div className="relative flex min-h-0 flex-1 flex-col">
    <div ref={viewport} tabIndex={0} role="region" aria-label="聊天记录"
      className={cx("min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring", className)}
      onWheel={(event) => {
        if (event.deltaY < 0 && !event.ctrlKey && event.currentTarget.scrollTop > 0) setFollow(false);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || event.altKey) return;
        if (event.key === "End" && !event.shiftKey) {
          event.preventDefault();
          jumpToLatest();
          return;
        }
        if (event.metaKey || event.ctrlKey || (event.shiftKey && event.key !== " ")) return;
        const pane = event.currentTarget;
        const distances: Record<string, number | undefined> = {
          ArrowUp: -40, ArrowDown: 40, PageUp: -pane.clientHeight, PageDown: pane.clientHeight,
          Home: -pane.scrollHeight, " ": pane.clientHeight * (event.shiftKey ? -1 : 1),
        };
        const distance = distances[event.key];
        if (distance === undefined) return;
        event.preventDefault();
        if (distance < 0 && pane.scrollTop > 0) setFollow(false);
        pane.scrollBy({ top: distance, behavior: "instant" });
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
      className="absolute bottom-2 left-1/2 z-1 -translate-x-1/2 rounded-full shadow-xs"
      onClick={() => { jumpToLatest(); viewport.current?.focus({ preventScroll: true }); }}>
      回到最新消息
    </Button>}
  </div>;
}
