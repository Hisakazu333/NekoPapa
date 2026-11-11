import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PixelPawIcon } from "@/components/foundations/icons/pixel-paw";
import { cx } from "@/utils/cx";

/*
 * 推理档位 track for the model menu's reasoning panel: a 40px pill whose
 * fill sits 4px in and runs to the far edge of a white pill thumb carrying
 * the pixel paw. The panel shows the level name; while dragging, the slider
 * reports the stop under the thumb through onPreview.
 * Its look rises with the level: none when the first stop turns thinking
 * off, solid accent on the lower half, an accent gradient with a few
 * twinkling pixel blocks above it, and a deep gradient full of pixel blocks
 * at the top stop. Unfilled stops show a 4px pixel each.
 *
 * Pressing anywhere on the track moves the thumb there and dragging follows
 * the pointer; releasing snaps to the nearest stop and commits it, a
 * cancelled drag returns to the committed stop. Keys step one stop at a time
 * through the native range input, which also names the value for assistive
 * tech. With reduced motion the pixels stay still.
 */

const INSET = 4;
const THUMB = 48;
const HALF = THUMB / 2;

/** Pixel blocks as % of the track; the first ten also show on the upper half. */
const PIXELS = Array.from({ length: 26 }, (_, index) => ({
  x: 4 + ((index * 37) % 90), y: 22 + ((index * 23) % 50), size: index % 3 === 0 ? 4 : index % 3 === 1 ? 3 : 2, delay: -((index * 0.43) % 2.6),
}));

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

export function ReasoningEffortSlider({ labels, value, onChange, onPreview, label, firstIsOff = false, description }: {
  /** Stop names, faster to smarter. */
  labels: readonly string[];
  /** The first stop turns thinking off, so it draws no fill. */
  firstIsOff?: boolean;
  /** Committed stop index. */
  value: number;
  onChange: (index: number) => void;
  /** The stop under the thumb while dragging (the committed one otherwise). */
  onPreview?: (index: number) => void;
  /** Accessible name of the range. */
  label: string;
  /** What the committed level does, as the range's description. */
  description?: string;
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

  const travel = (width: number) => Math.max(1, width - (INSET + HALF) * 2);
  const at = (clientX: number, offset: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return progress;
    return Math.max(0, Math.min(1, (clientX - box.left - INSET - HALF - offset) / travel(box.width)));
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
    const box = event.currentTarget.getBoundingClientRect();
    const center = INSET + HALF + progress * travel(box.width);
    const local = event.clientX - box.left;
    // Grabbing the thumb keeps it under the finger; elsewhere it jumps there.
    const offset = Math.abs(local - center) <= HALF ? local - center : 0;
    drag.current = { pointerId: event.pointerId, offset };
    setDragging(true);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* the drag still follows window moves */ }
    setProgress(at(event.clientX, offset));
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) setProgress(at(event.clientX, drag.current.offset));
  };

  const shown = Math.round(progress * last);
  const off = firstIsOff && shown === 0;
  useEffect(() => { onPreview?.(shown); }, [shown, onPreview]);
  const tier = off ? "off" : shown === last ? "max" : shown / last >= 0.5 ? "high" : "low";
  const pixels = tier === "max" ? PIXELS : tier === "high" ? PIXELS.slice(0, 10) : [];
  const center = (ratio: number) => `calc(${INSET + HALF}px + ${ratio} * (100% - ${(INSET + HALF) * 2}px))`;
  const ease = !dragging && "duration-200 ease-[cubic-bezier(.2,.9,.3,1)] motion-reduce:transition-none";

  return <div ref={track} onPointerDown={down} onPointerMove={move}
    onPointerUp={(event) => { if (drag.current?.pointerId === event.pointerId) finish(true); }}
    onPointerCancel={(event) => { if (drag.current?.pointerId === event.pointerId) finish(false); }}
    onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) finish(false); }}
    className={cx("@container relative h-10 w-full touch-none select-none rounded-full bg-background-tertiary-default", dragging ? "cursor-grabbing" : "cursor-pointer")}>
    {labels.map((name, index) => <i key={name} aria-hidden style={{ insetInlineStart: center(index / last) }}
      className="pointer-events-none absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 bg-foreground-icon-quaternary rtl:translate-x-1/2" />)}
    <div aria-hidden style={{ width: off ? 0 : `calc(${center(progress)} + ${HALF - INSET}px)`, insetBlock: INSET, insetInlineStart: INSET }}
      className={cx("absolute overflow-hidden rounded-full", ease && "transition-[width]", ease,
        tier === "max" ? "bg-linear-to-r from-accent-800 via-accent-600 to-accent-400"
          : tier === "high" ? "bg-linear-to-r from-accent-400 to-accent-600" : "bg-accent-500")}>
      <div className="absolute inset-y-0 start-0 w-[100cqw]">
        {pixels.map((pixel, index) => <i key={index}
          className={cx("absolute bg-control-indicator-background", reduced ? "opacity-60" : "opacity-0 animate-[neko-pixel-twinkle_2.6s_steps(4,end)_infinite]")}
          style={{ left: `${pixel.x}%`, top: `${pixel.y}%`, width: pixel.size, height: pixel.size, animationDelay: `${pixel.delay}s` }} />)}
      </div>
    </div>
    <div aria-hidden style={{ insetInlineStart: center(progress) }}
      className={cx("pointer-events-none absolute top-1/2 grid h-8 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-control-indicator-background shadow-md rtl:translate-x-1/2",
        ease && "transition-[inset-inline-start,scale]", ease, dragging && "scale-110", keyboard && "ring-2 ring-border-focus-ring")}>
      <PixelPawIcon className={cx("size-4 transition-colors", off ? "text-foreground-icon-quaternary" : "text-accent-500")} />
    </div>
    <input ref={range} type="range" min={0} max={last} step={1} value={value} aria-label={label} aria-valuetext={labels[value]} aria-description={description}
      onChange={(event) => { if (!drag.current) onChange(Number(event.target.value)); }}
      onKeyDown={() => setKeyboard(true)} onBlur={() => setKeyboard(false)}
      onClick={(event) => event.preventDefault()}
      className="pointer-events-none absolute inset-0 size-full appearance-none opacity-0" />
  </div>;
}
