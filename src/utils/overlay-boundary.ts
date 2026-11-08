import type { RefObject } from "react";

export type OverlayRef = RefObject<HTMLElement | null>;
export type OverlayRegistry = Set<OverlayRef>;

export function registerOverlayRefs(refs: OverlayRef[], ancestors: OverlayRegistry[]) {
  for (const registry of ancestors) {
    for (const ref of refs) registry.add(ref);
  }

  return () => {
    for (const registry of ancestors) {
      for (const ref of refs) registry.delete(ref);
    }
  };
}

export function isTargetWithinOverlay(
  target: Node,
  refs: OverlayRef[],
  descendants: OverlayRegistry,
) {
  return refs.some((ref) => ref.current?.contains(target))
    || Array.from(descendants).some((ref) => ref.current?.contains(target));
}
