/** Narrow bridge for the existing Cubism 4 / Pixi 6 browser distributions. */
export interface Live2DModel {
  anchor: { set(x: number, y: number): void };
  scale: { set(value: number): void };
  position: { set(x: number, y: number): void };
  internalModel: {
    localTransform: { apply(point: { x: number; y: number }): { x: number; y: number } };
    coreModel: { getDrawableCount(): number; getDrawableOpacity(index: number): number };
    getDrawableVertices(index: number): ArrayLike<number>;
  };
  update(delta: number): void;
  destroy(options?: { children?: boolean; texture?: boolean; baseTexture?: boolean }): void;
}

export interface Live2DApplication {
  stage: { addChild(model: Live2DModel): void };
  renderer: { resize(width: number, height: number): void; render(stage: unknown): void };
  destroy(removeView: boolean, options: { children: boolean; texture: boolean; baseTexture: boolean }): void;
}

export interface Live2DRuntime {
  Application: new (options: {
    view: HTMLCanvasElement; width: number; height: number; transparent: boolean;
    autoStart: boolean; resolution: number; antialias: boolean;
  }) => Live2DApplication;
  Point: new (x: number, y: number) => { x: number; y: number };
  live2d: { Live2DModel: { from(url: string, options: {
    autoInteract: boolean; autoUpdate: boolean; motionPreload: string;
  }): Promise<Live2DModel> } };
  utils: { skipHello(): void };
}
