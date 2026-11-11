import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PIXEL_PAW_BLOCKS, PixelPawIcon } from "@/components/foundations/icons/pixel-paw";
import { cx } from "@/utils/cx";

/*
 * NekoBuddy's own effort slider (design-mockups/ai-chat-gpt effort-slider.js):
 * a 64px pill with an 8px-inset bed, the accent fill reaching the thumb's
 * far edge, one dot per stop and a 44px white thumb carrying the pixel paw.
 * Dragging follows the pointer continuously and the label switches live;
 * releasing snaps to the nearest stop and commits it, a cancelled drag
 * returns to the committed stop. Keys step one stop at a time through the
 * native range input, which also names the value for assistive tech.
 * At the top stop the fill turns into the accent gradient and, with motion
 * allowed, white pixels drift and three pixel paws build up block by block.
 */

const INSET = 8;
const THUMB = 44;

const PIXELS = Array.from({ length: 18 }, (_, index) => ({
  x: 6 + index * 4.7, y: 18 + (index * 19) % 60, size: (index % 3) + 3, delay: -index * 0.21,
}));
const PRINTS = Array.from({ length: 3 }, (_, index) => ({ x: 22 + index * 22, y: index % 2 ? 51 : 22, delay: -0.8 - index * 1.05 }));

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return reduced;
}

export function ReasoningEffortSlider({ labels, value, onChange, label, firstIsOff = false }: {
  /** Stop names, faster to smarter. */
  labels: readonly string[];
  /** The first stop turns thinking off, so it draws faded. */
  firstIsOff?: boolean;
  /** Committed stop index. */
  value: number;
  onChange: (index: number) => void;
  /** Accessible name of the range. */
  label: string;
}) {
  const last = Math.max(1, labels.length - 1);
  const track = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const drag = useRef<{ pointerId: number; offset: number } | null>(null);
  const [progress, setProgress] = useState(value / last);
  const [dragging, setDragging] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => { if (!drag.current) setProgress(value / last); }, [value, last]);

  const geometry = () => {
    const width = track.current?.clientWidth ?? 0;
    const minimum = INSET + THUMB / 2;
    return { left: track.current?.getBoundingClientRect().left ?? 0, minimum, travel: Math.max(1, width - minimum * 2) };
  };
  const at = (clientX: number, offset: number) => {
    const { left, minimum, travel } = geometry();
    return Math.max(0, Math.min(1, (clientX - left - minimum - offset) / travel));
  };
  const finish = (commit: boolean) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    setDragging(false);
    if (track.current?.hasPointerCapture(current.pointerId)) track.current.releasePointerCapture(current.pointerId);
    if (commit) {
      const stop = Math.round(progress * last);
      setProgress(stop / last);
      if (stop !== value) onChange(stop);
    } else setProgress(value / last);
  };
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    range.current?.focus({ preventScroll: true });
    setKeyboard(false);
    const { left, minimum, travel } = geometry();
    const center = minimum + progress * travel;
    const local = event.clientX - left;
    // Grabbing the thumb keeps it under the finger; elsewhere it jumps there.
    const offset = Math.abs(local - center) <= THUMB / 2 ? local - center : 0;
    drag.current = { pointerId: event.pointerId, offset };
    setDragging(true);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* the drag still follows window moves */ }
    setProgress(at(event.clientX, offset));
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) setProgress(at(event.clientX, drag.current.offset));
  };

  const shown = Math.round(progress * last);
  const energy = progress >= 0.985;
  const animate = energy && !reduced;
  // Thumb centre and fill end share one geometry (see the mockup's paint()).
  const thumbX = `calc(${INSET + THUMB / 2}px + ${progress} * (100% - ${(INSET + THUMB / 2) * 2}px))`;

  return <div className="flex w-full flex-col items-center gap-3">
    <div className="relative flex min-h-8 items-center justify-center gap-1.5">
      <PixelPawIcon className={cx("size-5 text-accent-500 transition-opacity duration-200", energy ? "opacity-80" : "opacity-0")} />
      <output aria-live="polite" className={cx("text-title-3-semibold transition-colors duration-200", energy ? "text-accent-600" : "text-text-primary")}>{labels[shown]}</output>
    </div>
    <div ref={track} onPointerDown={down} onPointerMove={move}
      onPointerUp={(event) => { if (drag.current?.pointerId === event.pointerId) finish(true); }}
      onPointerCancel={(event) => { if (drag.current?.pointerId === event.pointerId) finish(false); }}
      onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) finish(false); }}
      className={cx("relative h-16 w-full touch-none select-none rounded-full border border-separator-border bg-background-primary-default/80 shadow-xs",
        dragging ? "cursor-grabbing" : "cursor-grab", keyboard && "ring-2 ring-border-focus-ring")}>
      <div aria-hidden className="absolute inset-2 overflow-hidden rounded-full bg-background-tertiary-default">
        <div style={{ width: `calc(${thumbX} + ${THUMB / 2 - INSET}px)` }}
          className={cx("absolute inset-y-0 start-0 overflow-hidden rounded-full",
            !dragging && "transition-[width,background-color] duration-200 ease-[cubic-bezier(.2,.9,.3,1)]",
            energy ? "bg-linear-[110deg] from-accent-700 via-accent-400 to-accent-200" : firstIsOff && shown === 0 ? "bg-accent-500/20" : "bg-accent-500")}>
          {animate && <>
            {PIXELS.map((pixel, index) => <i key={index} className="absolute rounded-[1px] bg-control-indicator-background opacity-0 motion-safe:animate-[neko-pixel-flow_4.2s_ease-in-out_infinite]"
              style={{ left: `${pixel.x}%`, top: `${pixel.y}%`, width: pixel.size, height: pixel.size, animationDelay: `${pixel.delay}s` }} />)}
            {PRINTS.map((print, index) => <svg key={index} viewBox="0 0 28 28" className="absolute size-[21px] fill-control-indicator-background" shapeRendering="crispEdges"
              style={{ left: `${print.x}%`, top: `${print.y}%` }}>
              {PIXEL_PAW_BLOCKS.map(([x, y], order) => <rect key={order} x={x} y={y} width={4} height={4}
                className="opacity-0 motion-safe:animate-[neko-paw-build_4.2s_ease-in-out_infinite]" style={{ animationDelay: `${print.delay + order * 0.03}s` }} />)}
            </svg>)}
          </>}
        </div>
      </div>
      <div aria-hidden className={cx("pointer-events-none absolute inset-y-0 flex items-center justify-between transition-opacity duration-200", energy ? "opacity-10" : "opacity-100")}
        style={{ insetInline: INSET + THUMB / 2 }}>
        {labels.map((name) => <i key={name} className="-mx-[3px] size-1.5 rounded-full bg-background-primary-default opacity-40" />)}
      </div>
      <div aria-hidden style={{ insetInlineStart: thumbX }}
        className={cx("pointer-events-none absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-separator-border bg-control-indicator-background shadow-md rtl:translate-x-1/2",
          !dragging && "transition-[inset-inline-start] duration-200 ease-[cubic-bezier(.2,1.12,.36,1)]")}>
        <PixelPawIcon className={cx("size-5 transition-colors", firstIsOff && shown === 0 ? "text-foreground-icon-tertiary" : "text-accent-500")} />
      </div>
      <input ref={range} type="range" min={0} max={last} step={1} value={value} aria-label={label} aria-valuetext={labels[value]}
        onChange={(event) => { if (!drag.current) onChange(Number(event.target.value)); }}
        onKeyDown={() => setKeyboard(true)} onBlur={() => setKeyboard(false)}
        onClick={(event) => event.preventDefault()}
        className="pointer-events-none absolute inset-0 size-full appearance-none opacity-0" />
    </div>
  </div>;
}
