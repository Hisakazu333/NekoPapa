export type DragKind = "rail" | "tab" | "group" | "item" | "favorite";

export interface DragRef {
  kind: DragKind;
  id: string;
  groupId?: string;
}

export interface DragTarget {
  kind: DragKind | "group-content";
  id?: string;
  groupId?: string;
  placement: "before" | "after" | "inside";
}

interface DragCallbacks {
  canDrop(source: DragRef, target: DragTarget): boolean;
  drop(source: DragRef, target: DragTarget): boolean;
  didDrop(focus?: string): void;
  beforeDrag(): void;
}

interface DragCandidate {
  source: DragRef;
  element: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  label: string;
  focus?: string;
}

interface DragSession extends DragCandidate {
  ghost: HTMLElement;
  marker: HTMLElement;
  target?: DragTarget;
  targetElement?: HTMLElement;
  valid: boolean;
}

const dragKinds: readonly string[] = ["rail", "tab", "group", "item", "favorite"];
const sourceSelector = "[data-drag-kind][data-drag-id]";
const targetSelector = `${sourceSelector}, [data-drop-kind="group-content"]`;
const blockedSelector = "input, textarea, select, [contenteditable], [data-no-drag], .row-more, .group-disclosure, .tab-close, .sidebar-resizer";

function reference(element: HTMLElement): DragRef | undefined {
  const kind = element.dataset.dragKind;
  const id = element.dataset.dragId;
  if (!kind || !id || !dragKinds.includes(kind) || element.dataset.dragDisabled === "true") return undefined;
  return { kind: kind as DragKind, id, ...(element.dataset.dragGroup ? { groupId: element.dataset.dragGroup } : {}) };
}

function sameReference(source: DragRef, target: DragTarget): boolean {
  return source.kind === target.kind && source.id === target.id;
}

function visible(element: HTMLElement): boolean {
  return !element.closest("[hidden], [inert]") && element.getClientRects().length > 0;
}

/** Pointer-based shell dragging works in a browser and in the native webview. */
export class ShellDragController {
  private candidate?: DragCandidate;
  private session?: DragSession;
  private animationFrame = 0;
  private previousFrame = 0;
  private suppressClickUntil = 0;
  private cancelledPointerId?: number;
  private announcement?: HTMLElement;
  private announcementTimer = 0;
  private readonly document: Document;
  private readonly window: Window;

  constructor(private readonly root: HTMLElement, private readonly callbacks: DragCallbacks) {
    this.document = root.ownerDocument;
    this.window = this.document.defaultView!;
    root.addEventListener("pointerdown", this.onPointerDown);
    root.addEventListener("dragstart", this.onNativeDragStart, true);
    this.document.addEventListener("pointermove", this.onPointerMove, true);
    this.document.addEventListener("pointerup", this.onPointerUp, true);
    this.document.addEventListener("pointercancel", this.onPointerCancel, true);
    this.document.addEventListener("keydown", this.onKeyDown, true);
    this.document.addEventListener("click", this.onClick, true);
    this.window.addEventListener("blur", this.onWindowBlur);
  }

  destroy(): void {
    this.clearDrag();
    this.root.removeEventListener("pointerdown", this.onPointerDown);
    this.root.removeEventListener("dragstart", this.onNativeDragStart, true);
    this.document.removeEventListener("pointermove", this.onPointerMove, true);
    this.document.removeEventListener("pointerup", this.onPointerUp, true);
    this.document.removeEventListener("pointercancel", this.onPointerCancel, true);
    this.document.removeEventListener("keydown", this.onKeyDown, true);
    this.document.removeEventListener("click", this.onClick, true);
    this.window.removeEventListener("blur", this.onWindowBlur);
    this.window.clearTimeout(this.announcementTimer);
    this.announcement?.remove();
  }

  cancel(): void {
    if (this.session) {
      this.cancelledPointerId = this.session.pointerId;
      this.announce("移动已取消");
    }
    this.clearDrag();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !event.isPrimary || this.session || event.defaultPrevented) return;
    this.cancelledPointerId = undefined;
    const hit = event.target instanceof Element ? event.target : undefined;
    if (!hit || hit.closest(blockedSelector)) return;
    const element = hit.closest<HTMLElement>(sourceSelector);
    if (!element || !this.root.contains(element) || !visible(element)) return;
    const source = reference(element);
    if (!source) return;
    const button = hit.closest<HTMLElement>("button");
    if (button && button !== element && !button.matches(".row-main, .tab-target, .rail-button, [data-drag-handle]")) return;
    const labelElement = element.querySelector<HTMLElement>(".row-title, .tab-title, .companion-name, [data-drag-label]");
    const label = labelElement?.textContent?.trim() || element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent?.trim() || source.id;
    this.candidate = {
      source, element, pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      label, focus: button?.dataset.focus ?? element.dataset.focus ?? element.querySelector<HTMLElement>("[data-focus]")?.dataset.focus,
    };
  };

  private readonly onNativeDragStart = (event: DragEvent): void => {
    if (this.candidate || this.session) event.preventDefault();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const drag = this.session ?? this.candidate;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) { this.cancel(); return; }
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!this.session) {
      if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 5) return;
      if (!this.startDrag(drag)) return;
    }
    event.preventDefault();
    this.positionGhost();
    this.updateTarget();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId === this.cancelledPointerId) {
      this.cancelledPointerId = undefined;
      this.suppressClickUntil = this.window.performance.now() + 400;
      event.preventDefault();
      return;
    }
    const drag = this.session ?? this.candidate;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!this.session) {
      this.candidate = undefined;
      return;
    }
    event.preventDefault();
    this.session.x = event.clientX;
    this.session.y = event.clientY;
    this.updateTarget();
    const { source, target, valid, focus, label } = this.session;
    this.suppressClickUntil = this.window.performance.now() + 400;
    // Remove capture and visual affordances before the owning controller rerenders.
    this.clearDrag();
    let changed = false;
    if (valid && target) {
      try { changed = this.callbacks.drop(source, target); } catch { changed = false; }
    }
    if (changed) {
      this.announce(`已移动${label}`);
      this.callbacks.didDrop(focus);
    } else this.announce("位置未改变");
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === (this.session ?? this.candidate)?.pointerId) this.cancel();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !(this.session || this.candidate)) return;
    event.preventDefault();
    event.stopPropagation();
    this.cancel();
  };

  private readonly onWindowBlur = (): void => this.cancel();

  private readonly onClick = (event: MouseEvent): void => {
    if (event.detail === 0 || this.window.performance.now() > this.suppressClickUntil) return;
    if (!(event.target instanceof Node) || !this.root.contains(event.target)) return;
    this.suppressClickUntil = 0;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private startDrag(candidate: DragCandidate): boolean {
    try { this.callbacks.beforeDrag(); } catch { this.clearDrag(); return false; }
    // Closing a menu can replace shell markup. Resolve the same source again.
    if (!candidate.element.isConnected) {
      const replacement = Array.from(this.root.querySelectorAll<HTMLElement>(sourceSelector)).find((element) => {
        const ref = reference(element);
        return ref?.kind === candidate.source.kind && ref.id === candidate.source.id;
      });
      if (!replacement) { this.clearDrag(); return false; }
      candidate.element = replacement;
    }
    if (!visible(candidate.element)) { this.clearDrag(); return false; }
    const ghost = this.document.createElement("div");
    ghost.className = "shell-drag-ghost";
    ghost.setAttribute("aria-hidden", "true");
    const sourceIcon = candidate.element.querySelector<SVGElement | HTMLImageElement>("svg, img");
    if (sourceIcon) {
      const clonedIcon = sourceIcon.cloneNode(true) as Element;
      for (const element of [clonedIcon, ...clonedIcon.querySelectorAll("*")]) {
        element.removeAttribute("id");
        element.removeAttribute("data-focus");
        element.removeAttribute("aria-labelledby");
      }
      ghost.append(clonedIcon);
    }
    const label = this.document.createElement("span");
    label.textContent = candidate.label;
    ghost.append(label);
    const marker = this.document.createElement("div");
    marker.className = "shell-drag-marker";
    marker.hidden = true;
    marker.setAttribute("aria-hidden", "true");
    this.document.body.append(ghost, marker);
    this.session = { ...candidate, ghost, marker, valid: false };
    this.candidate = undefined;
    candidate.element.classList.add("is-shell-drag-source");
    this.root.classList.add("is-shell-dragging");
    this.document.body.classList.add("has-shell-drag");
    this.document.getSelection()?.removeAllRanges();
    try { this.root.setPointerCapture(candidate.pointerId); } catch { /* Document listeners still handle mouse dragging. */ }
    this.announce(`正在移动${candidate.label}，按 Escape 取消`);
    this.positionGhost();
    this.previousFrame = 0;
    this.animationFrame = this.window.requestAnimationFrame(this.autoScroll);
    return true;
  }

  private positionGhost(): void {
    const drag = this.session;
    if (!drag) return;
    const width = drag.ghost.offsetWidth;
    const height = drag.ghost.offsetHeight;
    const left = Math.max(4, Math.min(drag.x + 14, this.window.innerWidth - width - 4));
    const top = Math.max(4, Math.min(drag.y + 16, this.window.innerHeight - height - 4));
    drag.ghost.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }

  private nearestTarget(hit: Element, source: DragRef, x: number, y: number): HTMLElement | undefined {
    const container = hit.closest<HTMLElement>(source.kind === "tab" ? ".tab-scroll" : source.kind === "rail" ? ".rail-top" : ".sidebar-scroll");
    if (!container) return undefined;
    const candidates = Array.from(container.querySelectorAll<HTMLElement>(sourceSelector)).filter((element) => {
      if (!visible(element)) return false;
      const kind = element.dataset.dragKind;
      return source.kind === "item" ? kind === "item" || kind === "group" : kind === source.kind;
    });
    if (source.kind === "favorite") {
      const sourceSection = this.session?.element.closest(".section-contents");
      if (!sourceSection || !sourceSection.contains(hit)) return undefined;
    }
    return candidates.sort((left, right) => {
      const a = left.getBoundingClientRect();
      const b = right.getBoundingClientRect();
      return source.kind === "tab" ? Math.abs(x - (a.left + a.right) / 2) - Math.abs(x - (b.left + b.right) / 2) : Math.abs(y - (a.top + a.bottom) / 2) - Math.abs(y - (b.top + b.bottom) / 2);
    })[0];
  }

  private updateTarget(): void {
    const drag = this.session;
    if (!drag) return;
    drag.targetElement?.classList.remove("is-shell-drop-inside");
    drag.target = undefined;
    drag.targetElement = undefined;
    drag.valid = false;
    drag.marker.hidden = true;
    const hit = this.document.elementFromPoint(drag.x, drag.y);
    if (hit && this.root.contains(hit) && !hit.closest("main, .sidebar-footer, .sidebar-header, .sidebar-resizer, .rail-bottom")) {
      let element = hit.closest<HTMLElement>(targetSelector) ?? this.nearestTarget(hit, drag.source, drag.x, drag.y);
      // A folder moves as a unit; its expanded children remain part of that unit.
      if (drag.source.kind === "group" && element && element.dataset.dragKind !== "group") {
        element = element.closest(".navigation-group")?.querySelector<HTMLElement>('[data-drag-kind="group"]') ?? element;
      }
      if (element && visible(element)) {
        const rect = element.getBoundingClientRect();
        const ref = reference(element);
        let target: DragTarget | undefined;
        if (element.dataset.dropKind === "group-content" && element.dataset.dropGroup) target = { kind: "group-content", groupId: element.dataset.dropGroup, placement: "inside" };
        else if (ref) target = {
          ...ref,
          placement: drag.source.kind === "item" && ref.kind === "group" ? "inside" : (drag.source.kind === "tab" ? drag.x < (rect.left + rect.right) / 2 : drag.y < (rect.top + rect.bottom) / 2) ? "before" : "after",
        };
        if (target && !sameReference(drag.source, target)) {
          drag.target = target;
          drag.targetElement = element;
          try { drag.valid = this.callbacks.canDrop(drag.source, target); } catch { drag.valid = false; }
          if (drag.valid) this.positionMarker(element, target, rect);
        }
      }
    }
    drag.ghost.classList.toggle("is-drop-denied", !drag.valid);
    this.document.body.classList.toggle("has-shell-drag-denied", !drag.valid);
  }

  private positionMarker(element: HTMLElement, target: DragTarget, rect: DOMRect): void {
    const drag = this.session!;
    const marker = drag.marker;
    marker.dataset.placement = target.placement;
    marker.dataset.axis = target.kind === "tab" ? "horizontal" : "vertical";
    const inside = target.placement === "inside";
    if (inside) element.classList.add("is-shell-drop-inside");
    if (drag.source.kind === "group" && target.kind === "group" && !inside) {
      rect = element.closest(".navigation-group")?.getBoundingClientRect() ?? rect;
    }
    const scrollBounds = element.closest(".sidebar-scroll, .tab-scroll")?.getBoundingClientRect();
    const visibleTop = scrollBounds ? Math.max(rect.top, scrollBounds.top) : rect.top;
    const visibleBottom = scrollBounds ? Math.min(rect.bottom, scrollBounds.bottom) : rect.bottom;
    let left = inside ? rect.left + 2 : target.kind === "tab" ? target.placement === "before" ? rect.left - 1 : rect.right - 1 : rect.left + 9;
    let top = inside ? visibleTop + 1 : target.kind === "tab" ? rect.top + 7 : target.placement === "before" ? rect.top - 1 : rect.bottom - 1;
    if (scrollBounds && !inside) {
      if (target.kind === "tab") left = Math.max(scrollBounds.left, Math.min(left, scrollBounds.right - 2));
      else top = Math.max(scrollBounds.top, Math.min(top, scrollBounds.bottom - 2));
    }
    marker.style.left = `${left}px`;
    marker.style.top = `${top}px`;
    marker.style.width = `${inside ? Math.max(0, rect.width - 4) : target.kind === "tab" ? 2 : Math.max(0, rect.width - 18)}px`;
    marker.style.height = `${inside ? Math.max(0, visibleBottom - visibleTop - 2) : target.kind === "tab" ? Math.max(0, rect.height - 14) : 2}px`;
    marker.hidden = inside && visibleBottom <= visibleTop;
  }

  private readonly autoScroll = (time: number): void => {
    const drag = this.session;
    if (!drag) return;
    const multiplier = this.previousFrame ? Math.min(2, (time - this.previousFrame) / 16.67) : 1;
    this.previousFrame = time;
    let scrolled = false;
    for (const container of this.root.querySelectorAll<HTMLElement>(".sidebar-scroll, .tab-scroll")) {
      const horizontal = container.classList.contains("tab-scroll");
      if (drag.source.kind === "rail" || (drag.source.kind === "tab") !== horizontal) continue;
      const rect = container.getBoundingClientRect();
      if (drag.x < rect.left || drag.x > rect.right || drag.y < rect.top || drag.y > rect.bottom) continue;
      const coordinate = horizontal ? drag.x : drag.y;
      const start = horizontal ? rect.left : rect.top;
      const end = horizontal ? rect.right : rect.bottom;
      const edge = Math.min(32, (end - start) / 4);
      const distance = coordinate < start + edge ? coordinate - start - edge : coordinate > end - edge ? coordinate - end + edge : 0;
      const speed = Math.sign(distance) * Math.min(12, Math.abs(distance) / edge * 12) * multiplier;
      if (!speed) continue;
      const original = horizontal ? container.scrollLeft : container.scrollTop;
      if (horizontal) container.scrollLeft += speed; else container.scrollTop += speed;
      scrolled ||= original !== (horizontal ? container.scrollLeft : container.scrollTop);
    }
    if (scrolled) this.updateTarget();
    this.animationFrame = this.window.requestAnimationFrame(this.autoScroll);
  };

  private clearDrag(): void {
    const drag = this.session;
    this.session = undefined;
    this.candidate = undefined;
    this.window.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.previousFrame = 0;
    drag?.element.classList.remove("is-shell-drag-source");
    drag?.targetElement?.classList.remove("is-shell-drop-inside");
    drag?.ghost.remove();
    drag?.marker.remove();
    this.root.classList.remove("is-shell-dragging");
    this.document.body.classList.remove("has-shell-drag", "has-shell-drag-denied");
    if (drag) {
      try { if (this.root.hasPointerCapture(drag.pointerId)) this.root.releasePointerCapture(drag.pointerId); } catch { /* Capture may already have ended. */ }
    }
  }

  private announce(message: string): void {
    if (!this.announcement) {
      this.announcement = this.document.createElement("span");
      this.announcement.className = "shell-drag-announcement";
      this.announcement.setAttribute("role", "status");
      this.announcement.setAttribute("aria-live", "polite");
      this.document.body.append(this.announcement);
    }
    this.window.clearTimeout(this.announcementTimer);
    this.announcement.textContent = message;
    this.announcementTimer = this.window.setTimeout(() => { if (this.announcement) this.announcement.textContent = ""; }, 2500);
  }
}
