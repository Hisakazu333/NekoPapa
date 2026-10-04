interface IconActivation {
  selector: string;
  index: number;
  disclosureTransform?: string;
  interruptedTransform?: string;
}

export class IconMotion {
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  private readonly running = new Map<Element, Animation>();

  capture(root: HTMLElement, button: HTMLButtonElement): IconActivation | null {
    if (this.reducedMotion.matches || button.disabled || !button.querySelector(".icon")) return null;
    const region = button.closest(".window-chrome, .icon-rail, .sidebar");
    if (!region) return null;
    const scope = region.classList.contains("window-chrome") ? ".window-chrome" : region.classList.contains("icon-rail") ? ".icon-rail" : ".sidebar";
    const attribute = (name: string) => button.hasAttribute(name) ? `[${name}="${CSS.escape(button.getAttribute(name)!)}"]` : "";
    const selector = `${scope} button${attribute("data-action")}${attribute("data-id")}${attribute("data-focus")}`;
    const disclosure = button.querySelector(".disclosure");
    const primary = button.querySelector(".icon:not(.disclosure)");
    return {
      selector,
      index: [...root.querySelectorAll(selector)].indexOf(button),
      disclosureTransform: disclosure ? getComputedStyle(disclosure).transform : undefined,
      interruptedTransform: primary && this.running.has(primary) ? getComputedStyle(primary).transform : undefined,
    };
  }

  play(root: HTMLElement, activation: IconActivation | null): void {
    if (!activation || this.reducedMotion.matches || document.hidden) return;
    // The shell replaces its DOM on navigation. Find the same control after that render.
    const button = root.querySelectorAll<HTMLButtonElement>(activation.selector)[activation.index];
    if (!button || button.closest("[inert]")) return;
    const disclosure = button.querySelector(".disclosure");
    if (disclosure && activation.disclosureTransform) {
      this.animate(disclosure, [
        { transform: activation.disclosureTransform },
        { transform: disclosure.classList.contains("is-expanded") ? "rotate(90deg)" : "rotate(0deg)" },
      ], 200, "nekopapa-disclosure");
    }

    const primary = button.querySelector(".icon:not(.disclosure)");
    if (!primary) return;
    const rail = button.classList.contains("rail-button");
    let frames: Keyframe[] = [
      { transform: rail ? "scale(.84)" : "scale(.90)", offset: 0 },
      { transform: rail ? "scale(1.05)" : "scale(1.025)", offset: .58 },
      { transform: "scale(1)", offset: 1 },
    ];
    let duration = rail ? 280 : 220;
    if (primary.classList.contains("icon-settings")) {
      frames = [{ transform: "rotate(-24deg) scale(.9)" }, { transform: "rotate(4deg) scale(1.02)", offset: .65 }, { transform: "rotate(0deg) scale(1)" }];
      duration = 320;
    } else if (primary.classList.contains("icon-bell")) {
      frames = [{ transform: "rotate(-12deg)" }, { transform: "rotate(9deg)", offset: .3 }, { transform: "rotate(-4deg)", offset: .65 }, { transform: "rotate(0deg)" }];
      duration = 360;
    } else if (primary.classList.contains("icon-left") || primary.classList.contains("icon-right")) {
      frames = [{ transform: `translateX(${primary.classList.contains("icon-left") ? "-2px" : "2px"})` }, { transform: "translateX(0)" }];
    } else if (primary.classList.contains("icon-down")) {
      frames = [{ transform: "translateY(1.5px)" }, { transform: "translateY(0)" }];
    } else if (primary.classList.contains("icon-plus")) {
      frames = [{ transform: "rotate(-45deg) scale(.9)" }, { transform: "rotate(0deg) scale(1)" }];
      duration = 260;
    }
    if (activation.interruptedTransform) frames[0] = { ...frames[0], transform: activation.interruptedTransform };
    this.animate(primary, frames, duration, "nekopapa-icon-feedback");

    const eyes = primary.querySelector('[data-motion-part="eyes"]');
    if (eyes) this.animate(eyes, [{ transform: "scaleY(1)" }, { transform: "scaleY(.15)", offset: .22 }, { transform: "scaleY(1)", offset: .6 }, { transform: "scaleY(1)" }], 280, "nekopapa-cat-blink");
    const pen = primary.querySelector('[data-motion-part="pen"]');
    if (pen) this.animate(pen, [{ transform: "translate(-.7px, .7px)" }, { transform: "translate(.5px, -.5px)", offset: .55 }, { transform: "translate(0, 0)" }], 260, "nekopapa-pen-stroke");
  }

  cancel(): void {
    for (const animation of this.running.values()) animation.cancel();
    this.running.clear();
  }

  private animate(target: Element, frames: Keyframe[], duration: number, id: string): void {
    this.running.get(target)?.cancel();
    const animation = target.animate(frames, { duration, easing: "cubic-bezier(.22, .75, .25, 1)" });
    animation.id = id;
    this.running.set(target, animation);
    const lifetime = new AbortController();
    const cleanup = () => {
      if (this.running.get(target) === animation) this.running.delete(target);
      lifetime.abort();
    };
    animation.addEventListener("finish", cleanup, { once: true, signal: lifetime.signal });
    animation.addEventListener("cancel", cleanup, { once: true, signal: lifetime.signal });
    this.reducedMotion.addEventListener("change", () => { if (this.reducedMotion.matches) animation.cancel(); }, { signal: lifetime.signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden) animation.cancel(); }, { signal: lifetime.signal });
  }
}
