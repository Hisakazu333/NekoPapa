import { useCallback, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type PointerEvent, type Ref, type RefObject } from "react";
import "./resizable-divider.css";

export interface ResizableDividerProps {
  label: string;
  value: number;
  min: number;
  max: number;
  direction: "left" | "right";
  onResize: (value: number | null) => void;
  preferredValue?: number | null;
  onReset: () => void;
  controls?: string;
  trackRef?: RefObject<HTMLElement | null>;
  ref?: Ref<HTMLDivElement>;
  className?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ResizableDivider({ label, value, min, max, direction, onResize, onReset, controls, trackRef, preferredValue, ref, className = "" }: ResizableDividerProps) {
  const dividerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; width: number; previousWidth: number | null; style: Array<[string, string, string]> } | null>(null);
  const [dragging, setDragging] = useState(false);
  const callbacksRef = useRef({ onResize });
  useEffect(() => { callbacksRef.current = { onResize }; }, [onResize]);
  useImperativeHandle(ref, () => dividerRef.current!, []);

  const followPointer = (clientY: number) => {
    const track = trackRef?.current ?? dividerRef.current;
    const divider = dividerRef.current;
    const handle = handleRef.current;
    if (!track || !divider || !handle) return;
    const trackBox = track.getBoundingClientRect();
    const dividerBox = divider.getBoundingClientRect();
    const edge = Math.min(12.5, trackBox.height / 2);
    const center = clamp(clientY - trackBox.top, edge, trackBox.height - edge);
    handle.style.setProperty("--divider-handle-position", `${center - (dividerBox.top - trackBox.top)}px`);
  };

  const restoreDrag = useCallback((cancelled: boolean, updateState = true) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    drag.style.forEach(([name, valueBefore, priority]) => {
      if (valueBefore) document.body.style.setProperty(name, valueBefore, priority);
      else document.body.style.removeProperty(name);
    });
    if (dividerRef.current?.hasPointerCapture(drag.pointerId)) dividerRef.current.releasePointerCapture(drag.pointerId);
    if (cancelled) callbacksRef.current.onResize(drag.previousWidth);
    if (updateState) setDragging(false);
  }, []);

  useEffect(() => {
    const onBlur = () => restoreDrag(false);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("blur", onBlur);
      restoreDrag(false, false);
    };
  }, [restoreDrag]);

  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    restoreDrag(false);
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    followPointer(event.clientY);
    const properties = ["cursor", "user-select", "-webkit-user-select"];
    const style = properties.map((name) => [name, document.body.style.getPropertyValue(name), document.body.style.getPropertyPriority(name)] as [string, string, string]);
    document.body.style.setProperty("cursor", "col-resize");
    document.body.style.setProperty("user-select", "none");
    document.body.style.setProperty("-webkit-user-select", "none");
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, width: value, previousWidth: preferredValue === undefined ? value : preferredValue, style };
    setDragging(true);
  };

  const movePointer = (event: PointerEvent<HTMLDivElement>) => {
    followPointer(event.clientY);
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.x;
    const signedDelta = direction === "left" ? delta : -delta;
    onResize(clamp(drag.width + signedDelta, min, max));
  };

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16;
    let next: number | undefined;
    if (event.key === "Escape" && dragRef.current) {
      event.preventDefault();
      restoreDrag(true);
      return;
    }
    if (event.key === "ArrowLeft") next = value + (direction === "right" ? step : -step);
    else if (event.key === "ArrowRight") next = value + (direction === "left" ? step : -step);
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    else if (event.key === "Enter") { event.preventDefault(); onReset(); return; }
    else return;
    event.preventDefault();
    onResize(clamp(next, min, max));
  };

  return <div ref={dividerRef} role="separator" tabIndex={0} aria-label={label} aria-orientation="vertical"
    aria-controls={controls} aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(value)}
    aria-valuetext={`${label}: ${Math.round(value)} 像素`}
    title="拖动调整宽度；方向键微调，Home / End 到边界，Enter 或双击恢复默认"
    className={`resizable-divider ${className}`} data-dragging={dragging || undefined}
    onPointerEnter={(event) => followPointer(event.clientY)} onPointerMove={movePointer}
    onPointerDown={beginDrag} onPointerUp={() => restoreDrag(false)} onPointerCancel={() => restoreDrag(true)}
    onLostPointerCapture={() => restoreDrag(false)} onDoubleClick={onReset} onKeyDown={resizeWithKeyboard}>
    <span ref={handleRef} className="resizable-divider-handle" aria-hidden>
      <span className="resizable-divider-lines"><i /><i /><i /></span>
    </span>
  </div>;
}
