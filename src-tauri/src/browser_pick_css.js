// The annotation UI's stylesheet for browser_pick.js, kept apart from its
// behaviour. browser_view.rs concatenates this file before browser_pick.js
// inside one wrapper function, so the page's globals never see either name.
// The page cannot read the app's tokens, so colours are mirrored and passed in.
function nekoPapaPickCss(ACCENT, ACCENT_DEEP) {
  return `
    :host { all: initial; }
    * { box-sizing: border-box; font: 13px/1.4 -apple-system, BlinkMacSystemFont, "PingFang SC", system-ui, sans-serif; }
    .layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; }
    .hover, .mark { position: fixed; border: 2px solid ${ACCENT}; border-radius: 4px; }
    .hover { border-style: dashed; background: rgba(236,72,153,.08); }
    .mark { background: rgba(236,72,153,.06); }
    .paused .mark, .paused .pin, .paused .note { display: none !important; }
    .pin { position: fixed; height: 24px; max-width: 200px; display: flex; align-items: center; gap: 6px; padding: 0 8px;
      border: 1.5px solid #fff; border-radius: 8px 8px 8px 0; background: linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP});
      color: #fff; pointer-events: auto; cursor: pointer; box-shadow: 0 0 0 1px rgba(0,0,0,.45), 0 4px 12px rgba(0,0,0,.3); }
    .pin:hover { background: linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP}); color: #fff; filter: brightness(1.08); }
    .pin b { font-size: 13px; font-weight: 700; }
    .pin span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 500; }
    .pin.inside { border-radius: 0 8px 8px 8px; }
    .tagname { position: fixed; padding: 2px 7px; border-radius: 6px; background: rgba(23,23,23,.9); color: #f4f4f5; white-space: nowrap;
      font: 11px/1.5 ui-monospace, Menlo, monospace; box-shadow: 0 0 0 1px rgba(255,255,255,.12); }
    .glass { background: rgba(23,23,23,.88); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,.10); box-shadow: 0 10px 30px rgba(0,0,0,.35); color: #f4f4f5; }
    .note { position: fixed; width: 320px; pointer-events: auto; border-radius: 18px; overflow: hidden; }
    .row { display: flex; align-items: center; gap: 4px; padding: 5px 5px 5px 14px; }
    .row input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #f4f4f5; }
    .row input::placeholder { color: #8b8b93; }
    .panel { border-top: 1px solid rgba(255,255,255,.08); padding: 4px 12px 10px; max-height: 260px; overflow-y: auto; overscroll-behavior: contain; }
    .panel-head { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; color: #a1a1aa; font-family: ui-monospace, Menlo, monospace; }
    .field { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 4px 0; }
    .field label { color: #d4d4d8; white-space: nowrap; }
    .field .control { display: flex; align-items: center; gap: 6px; height: 30px; width: 168px; padding: 0 8px; border-radius: 10px;
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); }
    .field .control.changed { border-color: rgba(236,72,153,.7); }
    .control input, .control select { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #f4f4f5;
      font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
    .control select option { color: #111; }
    .control input[type=color] { flex: none; width: 18px; height: 18px; padding: 0; border-radius: 50%; overflow: hidden; cursor: pointer; }
    .control input[type=color]::-webkit-color-swatch-wrapper { padding: 0; }
    .control input[type=color]::-webkit-color-swatch { border: 1px solid rgba(255,255,255,.3); border-radius: 50%; }
    .unit { color: #8b8b93; font-size: 12px; }
    button { all: unset; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 10px; color: #d4d4d8; }
    button:hover, button[aria-pressed=true] { background: rgba(255,255,255,.08); color: #fff; }
    button:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 1px; }
    button:disabled { opacity: .4; cursor: default; background: transparent; }
    svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .icon { width: 30px; height: 30px; border-radius: 12px; }
    .small { width: 24px; height: 24px; border-radius: 8px; }
    .small svg { width: 15px; height: 15px; }
    .round { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP}); color: #fff; }
    .round:hover { filter: brightness(1.08); color: #fff; }
    .bar { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; align-items: center; gap: 2px; padding: 6px;
      pointer-events: auto; border-radius: 22px; }
    .bar.moved { bottom: auto; transform: none; }
    .grip { width: 30px; height: 30px; border-radius: 12px; color: ${ACCENT}; cursor: grab; touch-action: none; }
    .grip:hover { color: ${ACCENT}; }
    .grip:active { cursor: grabbing; }
    .grip svg { width: 20px; height: 20px; }
    .grip path:first-child { fill: currentColor; stroke: none; }
    .paused-bar .grip { color: #8b8b93; }
    .count { padding: 0 10px; white-space: nowrap; }
    .hint { padding: 0 6px; color: #a1a1aa; white-space: nowrap; }
    .sep { width: 1px; height: 18px; margin: 0 4px; background: rgba(255,255,255,.14); }
    .send { height: 30px; padding: 0 14px; border-radius: 12px; background: linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP}); color: #fff; font-weight: 600; }
    .send:hover { filter: brightness(1.08); color: #fff; }
`;
}
