import type { Live2DApplication, Live2DModel, Live2DRuntime } from "./live2d-types";

// Serialize view handoffs so a cancelled load releases cached textures before the next load.
let pendingLoad: Promise<void> = Promise.resolve();

/** One canvas owns one model, RAF loop and WebGL context, including late async cleanup. */
export class Live2DPreview {
  private app?: Live2DApplication;
  private model?: Live2DModel;
  private disposed = false;
  private active = true;
  private reduced = false;
  private frame = 0;
  private lastTime = 0;
  private width = 1;
  private height = 1;
  private bounds?: { left: number; top: number; width: number; height: number };

  constructor(private canvas: HTMLCanvasElement, private runtime: Live2DRuntime, private onError?: (error: unknown) => void) {}

  load(url: string): Promise<void> {
    const work = pendingLoad.then(() => this.loadModel(url));
    pendingLoad = work.catch(() => undefined);
    return work;
  }

  private async loadModel(url: string): Promise<void> {
    if (this.disposed) return;
    const model = await this.runtime.live2d.Live2DModel.from(url, {
      autoInteract: false, autoUpdate: false, motionPreload: "NONE",
    });
    if (this.disposed) { model.destroy({ children: true, texture: true, baseTexture: true }); return; }
    this.model = model;
    try {
      this.app = new this.runtime.Application({
        view: this.canvas, width: this.width, height: this.height, transparent: true,
        autoStart: false, resolution: Math.min(window.devicePixelRatio || 1, 2), antialias: true,
      });
      model.anchor.set(0, 0);
      this.app.stage.addChild(model);
      model.update(0);
      this.bounds = this.measure(model);
      this.resize(this.width, this.height);
      this.schedule();
    } catch (error) { this.destroy(); throw error; }
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    if (!this.app || !this.model || !this.bounds || this.disposed) return;
    const bounds = this.bounds;
    const scale = Math.min(this.width * .88 / bounds.width, this.height * .92 / bounds.height);
    this.app.renderer.resize(this.width, this.height);
    this.model.scale.set(scale);
    this.model.position.set((this.width - bounds.width * scale) / 2 - bounds.left * scale,
      (this.height - bounds.height * scale) / 2 - bounds.top * scale);
    this.app.renderer.render(this.app.stage);
  }

  setActive(active: boolean, reduced = false) {
    this.active = active;
    this.reduced = reduced;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastTime = 0;
    this.schedule();
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    if (this.app) this.app.destroy(false, { children: true, texture: true, baseTexture: true });
    else this.model?.destroy({ children: true, texture: true, baseTexture: true });
    this.app = undefined;
    this.model = undefined;
    this.frame = 0;
  }

  private schedule() {
    if (this.disposed || !this.active || this.reduced || !this.app || this.frame) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (time: number) => {
    this.frame = 0;
    if (!this.app || !this.model || this.disposed || !this.active || this.reduced) return;
    const elapsed = this.lastTime ? time - this.lastTime : 34;
    // Preview at 30fps; avoid a large physics step after a background tab resumes.
    try {
      if (elapsed >= 32) {
        this.model.update(Math.min(elapsed, 80));
        this.app.renderer.render(this.app.stage);
        this.lastTime = time;
      }
    } catch (error) { this.destroy(); this.onError?.(error); return; }
    this.schedule();
  };

  private measure(model: Live2DModel) {
    const internal = model.internalModel;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let i = 0; i < internal.coreModel.getDrawableCount(); i++) {
      if (internal.coreModel.getDrawableOpacity(i) < .001) continue;
      const vertices = internal.getDrawableVertices(i);
      for (let j = 0; j < vertices.length; j += 2) {
        const point = internal.localTransform.apply(new this.runtime.Point(vertices[j], vertices[j + 1]));
        left = Math.min(left, point.x); right = Math.max(right, point.x);
        top = Math.min(top, point.y); bottom = Math.max(bottom, point.y);
      }
    }
    if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) throw new Error("Live2D 模型可见范围无效。");
    return { left, top, width: right - left, height: bottom - top };
  }
}
