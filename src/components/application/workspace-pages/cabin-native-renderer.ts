import { invoke } from "@tauri-apps/api/core";
import type { CabinFraming } from "./live2d-preview";

interface StageLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  exclusions: [number, number, number, number][];
}

export class NativeCabinRenderer {
  private owner = Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, "0")).join("");
  private mounted = false;
  private destroyed = false;
  private reduced = false;
  private active = true;
  private resizeFrame = 0;
  private previousLayout = "";
  private observer = new MutationObserver(() => this.resize());
  private framing: CabinFraming = "full";
  private gazeTimer = 0;
  private gazePending = false;
  private pointer: [number, number] | null = null;
  private lastGaze: { target: [number, number]; time: number } | null = null;
  motionGroups: string[] = [];

  constructor(private surface: HTMLElement, private report: (error: unknown) => void) {}

  private send<T>(action: { kind: string } & Record<string, unknown>): Promise<T> {
    return invoke("cabin_native", { owner: this.owner, action });
  }

  private layout(): StageLayout {
    const { x, y, width, height } = this.surface.getBoundingClientRect();
    // A native view is composited independently of the WebView's HTML portals.
    const modal = document.querySelector('[aria-modal="true"], [role="alertdialog"]');
    const boxes = [...document.querySelectorAll('[role="dialog"], [role="menu"], [role="listbox"]')]
      .map((overlay) => overlay.getBoundingClientRect())
      .filter((box) => box.width && box.height && box.right > x && box.bottom > y
        && box.x < x + width && box.y < y + height);
    // One merged exclusion avoids exposing overlaps between nested menu panels.
    const exclusions: StageLayout["exclusions"] = [];
    if (boxes.length) {
      const left = Math.min(...boxes.map((box) => box.x)) - 8;
      const top = Math.min(...boxes.map((box) => box.y)) - 8;
      const right = Math.max(...boxes.map((box) => box.right)) + 8;
      const bottom = Math.max(...boxes.map((box) => box.bottom)) + 8;
      exclusions.push([left - x, top - y, right - left, bottom - top]);
    }
    return {
      x, y, width: Math.max(width, 1), height: Math.max(height, 1), exclusions,
      visible: this.active && width > 0 && height > 0 && !this.surface.closest("[inert]") && !modal,
    };
  }

  resize() {
    if (!this.mounted || this.destroyed || this.resizeFrame) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      const layout = this.layout();
      const sample = JSON.stringify({ layout, reduced: this.reduced });
      if (sample === this.previousLayout) return;
      this.previousLayout = sample;
      void this.send({ kind: "layout", layout, reduced: this.reduced }).catch(this.onError);
    });
  }

  private onError = (error: unknown) => {
    if (!this.destroyed) {
      this.destroy();
      this.report(error);
    }
  };

  setActive(active: boolean, reduced: boolean) {
    this.active = active;
    this.reduced = reduced;
    if (!active || reduced) this.releasePointer();
    this.resize();
  }

  setFraming(framing: CabinFraming) {
    this.framing = framing;
    if (this.mounted && !this.destroyed)
      void this.send({ kind: "framing", close: framing === "close" }).catch(this.onError);
  }

  async load(mount: string) {
    const groups = await this.send<string[]>({ kind: "mount", mount, layout: this.layout(), reduced: this.reduced });
    if (this.destroyed) {
      await this.send({ kind: "unmount" });
      return;
    }
    this.mounted = true;
    this.motionGroups = groups;
    this.observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["inert", "role", "hidden", "aria-hidden", "aria-modal"] });
    this.setFraming(this.framing);
    this.resize();
    const deadline = performance.now() + 15_000;
    while (!this.destroyed) {
      if (await this.send<boolean>({ kind: "ready" })) return;
      if (performance.now() >= deadline) {
        this.destroy();
        throw new Error("原生 Live2D 模型加载超时，请重试。");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 125));
    }
  }

  playMotion(group: string): Promise<boolean> {
    return this.send({ kind: "motion", group });
  }

  tap(clientX: number, clientY: number) {
    const rect = this.surface.getBoundingClientRect();
    if (!this.mounted || this.reduced || this.destroyed || !rect.width || !rect.height) return;
    void this.send({ kind: "tap", x: (clientX - rect.x) / rect.width, y: (clientY - rect.y) / rect.height })
      .catch(this.onError);
  }

  trackPointer(clientX: number, clientY: number) {
    if (!this.mounted || this.destroyed || !this.active || this.reduced) return;
    const rect = this.surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const clamp = (value: number) => Math.max(-1, Math.min(1, value));
    const eyeLine = this.framing === "close" ? 0.34 : 0.22;
    this.pointer = [
      clamp(((clientX - rect.x) / rect.width - 0.5) * 2.8),
      clamp((eyeLine - (clientY - rect.y) / rect.height) * 2.4),
    ];
    if (!this.gazeTimer) {
      this.gazeTimer = window.setInterval(this.flushGaze, 50);
      this.flushGaze();
    }
  }

  releasePointer() {
    window.clearInterval(this.gazeTimer);
    this.gazeTimer = 0;
    this.pointer = null;
    this.flushGaze();
  }

  private flushGaze = () => {
    if (this.gazePending || this.destroyed || !this.mounted) return;
    const last = this.lastGaze;
    const target = this.pointer;
    const now = performance.now();
    if (!target && !last) return;
    if (target && last && now - last.time < 250 &&
      Math.hypot(target[0] - last.target[0], target[1] - last.target[1]) < 0.016) return;
    this.lastGaze = target ? { target, time: now } : null;
    this.gazePending = true;
    void this.send({ kind: "gaze", target }).catch(this.onError).finally(() => {
      this.gazePending = false;
      if (!this.pointer && this.lastGaze) this.flushGaze();
    });
  };

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer.disconnect();
    cancelAnimationFrame(this.resizeFrame);
    window.clearInterval(this.gazeTimer);
    if (this.mounted) void this.send({ kind: "unmount" }).catch(() => {});
  }
}
