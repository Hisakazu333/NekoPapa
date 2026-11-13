import { useEffect, useRef, useState, type RefObject } from "react";

const FIRST_ROWS = 300;
const MORE_ROWS = 600;

/**
 * How many rows of a long file or diff to render: the first few hundred,
 * then more each time the end comes within reach of the scroll box. A
 * 3,000-line diff rendered whole held the window for over two seconds;
 * nobody reads past the first screens without scrolling there first.
 * `content` starts the count again when the text changes.
 */
export function useRevealRows(total: number, content: unknown, scroller: RefObject<HTMLElement | null>) {
  const [state, setState] = useState({ content, count: FIRST_ROWS });
  const count = state.content === content ? state.count : FIRST_ROWS;
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || count >= total || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setState({ content, count: count + MORE_ROWS });
    }, { root: scroller.current, rootMargin: "0px 0px 800px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [content, count, total, scroller]);
  return { shown: Math.min(count, total), more: count < total, sentinel };
}
