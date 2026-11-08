const THEME_TRANSITION_DURATION = 820;
const THEME_TRANSITION_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const THEME_TRANSITION_STYLE_ID = "boardui-theme-transition-style";

export type ThemeTransitionOrigin = { x: number; y: number };

type ViewTransition = {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition: () => void;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransition;
};

let transitionRevision = 0;
let activeTransition: ViewTransition | undefined;

function createBlurCircleMask() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '<defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%">',
    '<feGaussianBlur stdDeviation="2" /></filter></defs>',
    '<circle cx="50" cy="50" r="42" fill="white" filter="url(#blur)" />',
    "</svg>",
  ].join("");

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function installThemeTransitionStyle(
  { x, y }: ThemeTransitionOrigin,
  radius: number,
  duration: number,
) {
  document.getElementById(THEME_TRANSITION_STYLE_ID)?.remove();

  const mask = createBlurCircleMask();
  const finalMaskSize = radius * 2.5;
  const finalMaskX = x - finalMaskSize / 2;
  const finalMaskY = y - finalMaskSize / 2;
  const style = document.createElement("style");
  style.id = THEME_TRANSITION_STYLE_ID;
  style.textContent = `
    ::view-transition-new(root) {
      -webkit-mask-image: ${mask};
      mask-image: ${mask};
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
      animation: boardui-theme-mask-reveal ${duration}ms ${THEME_TRANSITION_EASING} both;
      transform-origin: ${x}px ${y}px;
      will-change: -webkit-mask-size, -webkit-mask-position, mask-size, mask-position;
    }

    @keyframes boardui-theme-mask-reveal {
      from {
        -webkit-mask-position: ${x}px ${y}px;
        mask-position: ${x}px ${y}px;
        -webkit-mask-size: 0px 0px;
        mask-size: 0px 0px;
      }
      to {
        -webkit-mask-position: ${finalMaskX}px ${finalMaskY}px;
        mask-position: ${finalMaskX}px ${finalMaskY}px;
        -webkit-mask-size: ${finalMaskSize}px ${finalMaskSize}px;
        mask-size: ${finalMaskSize}px ${finalMaskSize}px;
      }
    }
  `;
  document.head.appendChild(style);
  return style;
}

function elementCenter(element: HTMLElement | null): ThemeTransitionOrigin {
  if (!element) {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function normalizedOrigin(
  origin: ThemeTransitionOrigin | null,
  element: HTMLElement | null,
): ThemeTransitionOrigin {
  const fallback = elementCenter(element);
  const x = origin?.x ?? fallback.x;
  const y = origin?.y ?? fallback.y;
  return {
    x: Math.min(Math.max(x, 0), window.innerWidth),
    y: Math.min(Math.max(y, 0), window.innerHeight),
  };
}

/** Latest request wins, including interrupted captures and immediate fallbacks. */
export async function revealTheme(
  update: () => void,
  {
    origin = null,
    element = null,
    duration = THEME_TRANSITION_DURATION,
    animate = true,
  }: {
    origin?: ThemeTransitionOrigin | null;
    element?: HTMLElement | null;
    duration?: number;
    animate?: boolean;
  } = {},
) {
  if (typeof document === "undefined") return;
  const revision = ++transitionRevision;
  activeTransition?.skipTransition();
  activeTransition = undefined;
  document.getElementById(THEME_TRANSITION_STYLE_ID)?.remove();
  document.documentElement.classList.remove("theme-transitioning");

  const transitionDocument = document as ViewTransitionDocument;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!animate || !transitionDocument.startViewTransition || reduceMotion) {
    update();
    return;
  }

  const { x, y } = normalizedOrigin(origin, element);
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  document.documentElement.classList.add("theme-transitioning");
  const transitionStyle = installThemeTransitionStyle({ x, y }, radius, duration);
  let applied = false;
  const applyLatest = () => {
    if (revision !== transitionRevision || applied) return;
    applied = true;
    update();
  };
  try {
    const transition = transitionDocument.startViewTransition(applyLatest);
    activeTransition = transition;
    await transition.ready;
    await transition.finished;
  } catch {
    // Unsupported captures and interrupted animations still apply the latest choice.
    applyLatest();
  } finally {
    transitionStyle.remove();
    if (revision === transitionRevision) {
      document.documentElement.classList.remove("theme-transitioning");
      activeTransition = undefined;
    }
  }
}
