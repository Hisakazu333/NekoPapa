/** 当前是否运行在 Tauri 桌面宿主内（而非浏览器预览） */
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri: boolean =
  typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

/** 设计预览模式：浏览器加 ?preview=1 时启用居中卡片外壳（仅用于对照原型页） */
export const isPreview: boolean =
  !isTauri &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("preview");
