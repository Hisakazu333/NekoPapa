// Element picker injected into the built-in browser's page by browser_view.rs.
// Hovering outlines an element; a click captures it, Escape cancels. The app
// polls `window.__nekoPapaPick.take()` for the result: `{ pending: true }`
// while picking, the element (or `{ cancelled: true }`) once, then null.
// Everything it reads is page content and is validated again by the app.
(() => {
  const KEY = "__nekoPapaPick";
  window[KEY]?.stop();

  const HTML_LIMIT = 4000;
  const TEXT_LIMIT = 500;
  const STYLES = [
    "display", "position", "width", "height", "margin", "padding", "color", "background-color",
    "font-family", "font-size", "font-weight", "line-height", "border", "border-radius", "box-shadow", "gap",
  ];
  const root = document.documentElement;
  const box = document.createElement("div");
  const label = document.createElement("div");
  const layer = "position:fixed;z-index:2147483647;pointer-events:none;box-sizing:border-box;display:none;";
  box.style.cssText = layer + "border:2px solid #2f7cf6;background:rgba(47,124,246,.12);border-radius:4px;";
  label.style.cssText = layer + "padding:2px 6px;border-radius:4px;background:#2f7cf6;color:#fff;white-space:nowrap;"
    + "font:12px/1.4 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;";
  root.append(box, label);

  let target = null;
  let result = null;
  let active = true;
  const cursor = root.style.cursor;
  root.style.cursor = "crosshair";

  const name = (el) => {
    const tag = el.tagName.toLowerCase();
    if (el.id) return `${tag}#${CSS.escape(el.id)}`;
    const classes = [...el.classList].slice(0, 2).map((c) => `.${CSS.escape(c)}`).join("");
    return tag + classes;
  };
  // A short selector: up to five steps, stopping at a unique id.
  const selector = (el) => {
    const steps = [];
    for (let node = el; node && node.nodeType === 1 && node !== root && steps.length < 5; node = node.parentElement) {
      if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
        steps.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      let step = node.tagName.toLowerCase();
      const siblings = node.parentElement ? [...node.parentElement.children].filter((s) => s.tagName === node.tagName) : [];
      if (siblings.length > 1) step += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      steps.unshift(step);
    }
    return steps.join(" > ");
  };
  const show = (el) => {
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { display: "block", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    label.textContent = `${name(el)}  ${Math.round(r.width)}×${Math.round(r.height)}`;
    const above = r.top > 26;
    Object.assign(label.style, { display: "block", left: `${Math.max(0, r.left)}px`, top: `${above ? r.top - 24 : r.bottom + 4}px` });
  };
  const swallow = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  const onMove = (event) => {
    const el = event.target;
    if (!(el instanceof Element) || el === box || el === label) return;
    target = el;
    show(el);
  };
  const onClick = (event) => {
    swallow(event);
    if (!target) return;
    const el = target;
    const r = el.getBoundingClientRect();
    const computed = getComputedStyle(el);
    const html = el.outerHTML;
    result = {
      url: location.href,
      title: document.title,
      selector: selector(el),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, TEXT_LIMIT),
      html: html.slice(0, HTML_LIMIT),
      htmlTruncated: html.length > HTML_LIMIT,
      rect: { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
      styles: Object.fromEntries(STYLES.map((p) => [p, computed.getPropertyValue(p)])),
    };
    stop();
  };
  const onKey = (event) => {
    if (event.key !== "Escape") return;
    swallow(event);
    result = { cancelled: true };
    stop();
  };
  const events = [["mousemove", onMove], ["click", onClick], ["mousedown", swallow], ["mouseup", swallow], ["pointerdown", swallow], ["keydown", onKey]];
  for (const [type, handler] of events) window.addEventListener(type, handler, true);

  function stop() {
    if (!active) return;
    active = false;
    for (const [type, handler] of events) window.removeEventListener(type, handler, true);
    box.remove();
    label.remove();
    root.style.cursor = cursor;
  }

  window[KEY] = {
    stop,
    take() {
      if (result) {
        const taken = result;
        result = null;
        return taken;
      }
      return active ? { pending: true } : null;
    },
  };
})();
