// NekoPapa interface plugin bridge (served at /__sdk/plugin-bridge.js).
// A plugin's frame page loads it with
//   <script src="/__sdk/plugin-bridge.js"></script>
// (the one absolute path a page uses; its own files are linked relatively)
// and then uses `window.nekopapa`:
//   const context = await nekopapa.ready;        // { pluginId, viewId, permissions }
//   const values = await nekopapa.call("settings.get");
//   nekopapa.onTheme((theme) => { ... });        // theme.mode is "light" or "dark"
// The page runs in a sandboxed frame with no access to the app; every call
// goes through one MessagePort the app hands over, and the app checks each
// call against the permissions the user granted. The app's colors arrive as
// CSS variables on :root (--np-*), so pages follow the light and dark theme.
// Served by src-tauri/src/plugin_frame.rs and scripts/plugin-frame-api.ts.
(() => {
  "use strict";
  if (window.nekopapa) return;
  const pending = new Map();
  const themeListeners = new Set();
  let port;
  let next = 1;
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });

  const applyTheme = (theme) => {
    if (!theme || typeof theme !== "object") return;
    const root = document.documentElement;
    root.dataset.theme = theme.mode === "dark" ? "dark" : "light";
    root.style.colorScheme = root.dataset.theme;
    for (const [name, value] of Object.entries(theme.variables || {})) {
      if (/^--np-[a-z0-9-]+$/.test(name) && typeof value === "string") root.style.setProperty(name, value);
    }
    for (const listener of themeListeners) {
      try { listener(theme); } catch (error) { console.error(error); }
    }
  };

  const receive = (event) => {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    if (message.type === "theme") { applyTheme(message.theme); return; }
    if (message.type !== "response" || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      const error = new Error(String(message.error.message || "调用失败。"));
      error.code = message.error.code;
      reject(error);
    } else resolve(message.result);
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || message.type !== "nekopapa:connect" || !event.ports[0]) return;
    if (port) port.close();
    for (const { reject } of pending.values()) reject(new Error("连接已重新建立。"));
    pending.clear();
    port = event.ports[0];
    port.onmessage = receive;
    applyTheme(message.theme);
    resolveReady(Object.freeze({ ...message.context }));
  });

  const call = async (method, params) => {
    await ready;
    if (typeof method !== "string") throw new TypeError("method 必须是字符串。");
    const id = next++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      port.postMessage({ type: "request", id, method, params: params === undefined ? null : params });
    });
  };

  const onTheme = (listener) => {
    themeListeners.add(listener);
    return () => themeListeners.delete(listener);
  };

  Object.defineProperty(window, "nekopapa", { value: Object.freeze({ version: 1, ready, call, onTheme }) });
})();
