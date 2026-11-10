// Annotation mode injected into the built-in browser's page by browser_view.rs.
// Hovering outlines an element; a click pins it with a number and opens a
// note beside it: a comment, and an optional style panel that previews
// changes (colours, opacity, type, radius) on the page itself, and can move
// the mark up to the parent element. Pins are NekoPapa's tag shape (the same
// shape as the cursor and the app's 批注 icon), numbered, with the comment's
// start once written. The toolbar at the bottom (it moves to the top when the
// pointer comes near) shows the count and can pause, so the page works
// normally until annotating resumes, clear the pins, add them to the chat, or
// leave. Leaving or sending puts every previewed style back.
// The app polls `window.__nekoPapaPick.take()`: `{ pending: true }` while
// annotating, `{ annotations: [...] }` (or `{ cancelled: true }`) once, then
// null. Everything read here is page content and is validated again by the
// app (src/app/browser-pick.ts). The UI lives in a closed shadow root so the
// page's styles cannot reach it, and page handlers never see its events.
(() => {
  const KEY = "__nekoPapaPick";
  window[KEY]?.stop();

  const MAX = 5;
  const HTML_LIMIT = 4000;
  const TEXT_LIMIT = 500;
  const COMMENT_LIMIT = 1000;
  // NekoPapa's default pink accent (theme.css accent-500 / 600) and the dock's
  // dark glass surface; the page cannot read the app's tokens, so they are mirrored here.
  const ACCENT = "#ec4899";
  const ACCENT_DEEP = "#db2777";
  const STYLES = [
    "display", "position", "width", "height", "margin", "padding", "color", "background-color",
    "font-family", "font-size", "font-weight", "line-height", "border", "border-radius", "box-shadow", "gap", "opacity",
  ];
  // What the style panel can preview. Units are added by the panel.
  const EDITS = [
    { prop: "color", label: "文字颜色", kind: "color" },
    { prop: "background-color", label: "背景", kind: "color" },
    { prop: "opacity", label: "不透明度", kind: "number", min: 0, max: 1, step: 0.05 },
    { prop: "font-size", label: "字号", kind: "number", unit: "px", min: 6, max: 160, step: 1 },
    { prop: "font-weight", label: "字重", kind: "select", options: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] },
    { prop: "border-radius", label: "圆角", kind: "number", unit: "px", min: 0, max: 200, step: 1 },
  ];
  const ICONS = {
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    sliders: '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    parent: '<path d="M5 3h14"/><path d="m18 13-6-6-6 6"/><path d="M12 7v14"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/>',
  };
  // The 批注 tag: a rounded label whose sharp corner points at what it marks.
  // Its tip is the cursor's hotspot. Mirrors AnnotateIcon in app-icons.tsx.
  const TAG = "M8 3.5h8.5a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H9.5L4 21V7.5a4 4 0 0 1 4-4z";
  const CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24">`
    + `<path d="${TAG}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="3.2" stroke-linejoin="round"/>`
    + `<path d="${TAG}" fill="${ACCENT}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>`
    + `<path d="M12.25 7.5v6M9.25 10.5h6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const CURSOR = `url("data:image/svg+xml,${encodeURIComponent(CURSOR_SVG)}") 5 24, crosshair`;
  const CSS_TEXT = `
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
      pointer-events: auto; border-radius: 22px; transition: top .18s ease, bottom .18s ease; }
    .bar.top { bottom: auto; top: 16px; }
    .bar .tag { width: 20px; height: 20px; margin-left: 6px; color: ${ACCENT}; }
    .bar .tag path:first-child { fill: currentColor; stroke: none; }
    .paused-bar .tag { color: #8b8b93; }
    .count { padding: 0 10px; white-space: nowrap; }
    .hint { padding: 0 6px; color: #a1a1aa; white-space: nowrap; }
    .sep { width: 1px; height: 18px; margin: 0 4px; background: rgba(255,255,255,.14); }
    .send { height: 30px; padding: 0 14px; border-radius: 12px; background: linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP}); color: #fff; font-weight: 600; }
    .send:hover { filter: brightness(1.08); color: #fff; }
  `;

  const root = document.documentElement;
  const host = document.createElement("nekopapa-annotate");
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `<style>${CSS_TEXT}</style><div class="layer"></div>`;
  const layer = shadow.querySelector(".layer");
  root.append(host);

  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  const make = (tag, className, html) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (html) el.innerHTML = html;
    return el;
  };
  const hover = make("div", "hover");
  const tagname = make("div", "tagname");
  const marks = make("div");
  const bar = make("div", "bar glass");
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "网页批注");
  layer.append(hover, tagname, marks, bar);
  hover.style.display = "none";
  tagname.style.display = "none";

  const annotations = [];
  let target = null;
  let paused = false;
  let notice = "";
  let result = null;
  let active = true;
  let frame = 0;
  // The open note: built once per pin and only moved on scroll, so typing
  // and the style controls keep their focus.
  let note = null;
  // The tag cursor must win over the page's own cursors (links, buttons).
  const cursorStyle = document.createElement("style");
  cursorStyle.textContent = `html, html * { cursor: ${CURSOR} !important; }`;
  const showCursor = (on) => { if (on) (document.head || root).append(cursorStyle); else cursorStyle.remove(); };
  showCursor(true);

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
  const capture = (el) => {
    const r = el.getBoundingClientRect();
    const computed = getComputedStyle(el);
    const html = el.outerHTML;
    return {
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
  };
  const place = (node, r) => Object.assign(node.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const hex = (value) => {
    const parts = value.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return "#000000";
    return `#${parts.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, "0")).join("")}`;
  };

  // Style previews write inline !important values; the element's own
  // style attribute is kept so it can be put back exactly.
  function preview(item, prop, value) {
    if (!("inline" in item)) item.inline = item.el.getAttribute("style");
    const from = item.data.styles[prop] ?? getComputedStyle(item.el).getPropertyValue(prop);
    item.el.style.setProperty(prop, value, "important");
    item.changes[prop] = { from, to: value };
  }
  function restore(item) {
    if (!("inline" in item)) return;
    if (item.inline === null) item.el.removeAttribute("style"); else item.el.setAttribute("style", item.inline);
    delete item.inline;
  }
  function resetStyles(item) {
    restore(item);
    item.changes = {};
  }

  // The click often lands on a span inside the real target: move the mark up.
  const parentOf = (item) => {
    const parent = item.el.parentElement;
    return parent && markable(parent) && !annotations.some((other) => other.el === parent) ? parent : null;
  };
  function moveToParent(index) {
    const item = annotations[index];
    const parent = item && parentOf(item);
    if (!parent) return;
    saveComment();
    resetStyles(item);
    Object.assign(item, { el: parent, data: capture(parent), rect: parent.getBoundingClientRect() });
    openNote(index, note?.styles);
  }

  function saveComment() {
    const item = note && annotations[note.index];
    if (item) item.comment = note.el.querySelector(".row input").value.trim().slice(0, COMMENT_LIMIT);
  }
  function closeNote() {
    saveComment();
    note?.el.remove();
    note = null;
    render();
  }

  function stylePanel(item) {
    const panel = make("div", "panel", `<div class="panel-head"><span></span>`
      + `<button class="small" data-act="reset" aria-label="还原样式" title="还原样式">${icon("undo")}</button></div>`);
    panel.querySelector(".panel-head span").textContent = `<${item.data.tag}>`;
    for (const edit of EDITS) {
      const field = make("div", "field");
      const id = `neko-${edit.prop}`;
      const current = item.changes[edit.prop]?.to ?? item.data.styles[edit.prop] ?? getComputedStyle(item.el).getPropertyValue(edit.prop);
      field.append(make("label"));
      field.firstChild.textContent = edit.label;
      field.firstChild.htmlFor = id;
      const control = make("div", `control${item.changes[edit.prop] ? " changed" : ""}`);
      const apply = (value) => { preview(item, edit.prop, value); control.classList.add("changed"); render(); };
      if (edit.kind === "color") {
        const swatch = make("input");
        const label = make("input");
        swatch.type = "color";
        swatch.value = hex(current);
        swatch.setAttribute("aria-label", `${edit.label}取色`);
        label.id = id;
        label.value = current;
        swatch.addEventListener("input", () => { label.value = swatch.value; apply(swatch.value); });
        label.addEventListener("change", () => { if (CSS.supports("color", label.value)) { swatch.value = hex(label.value); apply(label.value); } });
        control.append(swatch, label);
      } else if (edit.kind === "select") {
        const select = make("select");
        select.id = id;
        select.innerHTML = edit.options.map((option) => `<option>${option}</option>`).join("");
        select.value = edit.options.includes(current) ? current : "400";
        select.addEventListener("change", () => apply(select.value));
        control.append(select);
      } else {
        const input = make("input");
        input.id = id;
        Object.assign(input, { type: "number", min: edit.min, max: edit.max, step: edit.step });
        input.value = String(parseFloat(current) || 0);
        input.addEventListener("input", () => {
          const value = Number(input.value);
          if (input.value !== "" && value >= edit.min && value <= edit.max) apply(`${value}${edit.unit ?? ""}`);
        });
        control.append(input);
        if (edit.unit) control.append(make("span", "unit", edit.unit));
      }
      field.append(control);
      panel.append(field);
    }
    panel.querySelector('[data-act="reset"]').addEventListener("click", () => { resetStyles(item); openNote(note.index, true); });
    return panel;
  }

  function openNote(index, styles = false) {
    saveComment();
    note?.el.remove();
    const item = annotations[index];
    if (!item) { note = null; render(); return; }
    const el = make("div", "note glass", `<div class="row"><input placeholder="想怎么改？" maxlength="${COMMENT_LIMIT}">`
      + `<button class="icon" data-act="parent" aria-label="改为上一层元素" title="改为上一层元素"${parentOf(item) ? "" : " disabled"}>${icon("parent")}</button>`
      + `<button class="icon" data-act="styles" aria-pressed="${styles}" title="调整样式">${icon("sliders")}</button>`
      + `<button class="icon" data-act="remove" aria-label="删除这条批注" title="删除">${icon("trash")}</button>`
      + `<button class="round" data-act="save" aria-label="保存批注" title="保存（Enter）">${icon("up")}</button></div>`);
    const input = el.querySelector(".row input");
    input.setAttribute("aria-label", `批注 ${index + 1} 的评论`);
    el.querySelector('[data-act="styles"]').setAttribute("aria-label", styles ? "收起样式" : "调整样式");
    input.value = item.comment;
    if (styles) el.append(stylePanel(item));
    el.querySelector('[data-act="styles"]').addEventListener("click", () => openNote(index, !styles));
    el.querySelector('[data-act="remove"]').addEventListener("click", () => remove(index));
    el.querySelector('[data-act="parent"]').addEventListener("click", () => moveToParent(index));
    el.querySelector('[data-act="save"]').addEventListener("click", closeNote);
    input.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); closeNote(); }
    });
    layer.append(el);
    note = { el, index, styles };
    render();
    input.focus();
  }
  function remove(index) {
    note?.el.remove();
    note = null;
    restore(annotations[index]);
    annotations.splice(index, 1);
    render();
  }

  // Pins follow their elements; the note sits below its element, or above it near the bottom.
  function render() {
    frame = 0;
    if (!active) return;
    layer.classList.toggle("paused", paused);
    marks.replaceChildren();
    annotations.forEach((item, index) => {
      const r = item.el.isConnected ? item.el.getBoundingClientRect() : item.rect;
      item.rect = { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.top + r.height };
      const mark = make("div", "mark");
      place(mark, item.rect);
      // The tag sits on the element's top-left corner, tip down; inside the element when there is no room above.
      const inside = item.rect.top < 28;
      const pin = make("button", `pin${inside ? " inside" : ""}`, `<b>${index + 1}</b>`);
      const changed = Object.keys(item.changes).length;
      const summary = item.comment || (changed ? `改了 ${changed} 项样式` : "");
      if (summary) pin.append(make("span"));
      if (summary) pin.lastChild.textContent = summary;
      pin.setAttribute("aria-label", `批注 ${index + 1}${summary ? `：${summary}` : ""}`);
      Object.assign(pin.style, { left: `${Math.max(0, item.rect.left)}px`, top: inside ? `${Math.max(0, item.rect.top)}px` : `${item.rect.top - 25}px` });
      pin.addEventListener("click", () => openNote(index));
      marks.append(mark, pin);
    });
    const item = note && annotations[note.index];
    if (item) {
      note.el.style.display = "block";
      const height = note.el.offsetHeight || 44;
      const below = item.rect.bottom + height + 16 < innerHeight;
      const left = Math.min(Math.max(8, item.rect.left), innerWidth - 328);
      Object.assign(note.el.style, { left: `${left}px`, top: `${below ? item.rect.bottom + 8 : Math.max(8, item.rect.top - height - 8)}px` });
    }
    const count = annotations.length;
    bar.classList.toggle("paused-bar", paused);
    const status = paused ? "已暂停，网页可正常操作" : count ? `批注 ${count} / ${MAX}` : "点选网页元素，写下想改的地方";
    bar.innerHTML = `<svg class="tag" viewBox="0 0 24 24" aria-hidden="true"><path d="${TAG}"/><path d="M12.25 7.5v6M9.25 10.5h6" stroke="#fff" stroke-width="1.8"/></svg>`
      + `<span class="count">${status}</span>`
      + (notice ? `<span class="hint">${notice}</span>` : "")
      + `<span class="sep"></span>`
      + `<button class="icon" data-act="pause" aria-pressed="${paused}" aria-label="${paused ? "继续批注" : "暂停批注"}" title="${paused ? "继续批注" : "暂停批注：操作网页后再继续"}">${icon(paused ? "play" : "pause")}</button>`
      + `<button class="icon" data-act="clear" aria-label="清除全部批注" title="清除全部"${count ? "" : " disabled"}>${icon("trash")}</button>`
      + `<button class="send" data-act="send"${count ? "" : " disabled"}>加入对话</button>`
      + `<button class="icon" data-act="exit" aria-label="退出批注" title="退出（Esc）">${icon("close")}</button>`;
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };

  bar.addEventListener("click", (event) => {
    const act = event.target instanceof Element ? event.target.closest("button")?.dataset.act : undefined;
    if (act === "pause") {
      paused = !paused;
      if (paused) { saveComment(); note?.el.remove(); note = null; hover.style.display = "none"; tagname.style.display = "none"; }
      showCursor(!paused);
    }
    if (act === "clear") { note?.el.remove(); note = null; annotations.forEach(restore); annotations.length = 0; notice = ""; }
    if (act === "send") {
      saveComment();
      finish({ annotations: annotations.map(({ data, comment, changes }) => ({ ...data, comment, changes })) });
      return;
    }
    if (act === "exit") { finish({ cancelled: true }); return; }
    render();
  });
  // Keys typed in the note stay inside it: the page never sees them.
  layer.addEventListener("keydown", (event) => event.stopPropagation());

  const ours = (event) => event.composedPath().includes(host);
  const swallow = (event) => {
    if (ours(event) || paused) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  // The page root and body are not useful annotations; a click without a
  // hover first (keyboard, touch) still marks what was clicked.
  function markable(el) { return el instanceof Element && el !== root && el !== document.body; }
  const onMove = (event) => {
    // Near the toolbar, it moves to the other edge so it never covers what is being marked.
    const box = bar.getBoundingClientRect();
    const near = event.clientX > box.left - 40 && event.clientX < box.right + 40;
    if (near && !bar.classList.contains("top") && event.clientY > box.top - 40) bar.classList.add("top");
    else if (near && bar.classList.contains("top") && event.clientY < box.bottom + 40) bar.classList.remove("top");
    const el = event.target;
    if (ours(event) || !markable(el) || paused) { hover.style.display = "none"; tagname.style.display = "none"; target = null; return; }
    target = el;
    const r = el.getBoundingClientRect();
    place(hover, r);
    hover.style.display = "block";
    tagname.textContent = `${el.tagName.toLowerCase()}  ${Math.round(r.width)}×${Math.round(r.height)}`;
    Object.assign(tagname.style, { display: "block", left: `${Math.max(4, r.left)}px`, top: `${r.bottom + 26 < innerHeight ? r.bottom + 4 : Math.max(4, r.top - 24)}px` });
  };
  const onClick = (event) => {
    if (ours(event) || paused) return;
    swallow(event);
    target = event.target;
    if (!markable(target)) return;
    const existing = annotations.findIndex((item) => item.el === target);
    if (existing >= 0) { openNote(existing); return; }
    if (annotations.length >= MAX) { notice = `最多 ${MAX} 处`; closeNote(); return; }
    notice = "";
    annotations.push({ el: target, data: capture(target), comment: "", changes: {}, rect: target.getBoundingClientRect() });
    openNote(annotations.length - 1);
  };
  const onKey = (event) => {
    if (ours(event) || paused || event.key !== "Escape") return;
    swallow(event);
    if (note) closeNote(); else finish({ cancelled: true });
  };
  const events = [["mousemove", onMove], ["click", onClick], ["mousedown", swallow], ["mouseup", swallow], ["pointerdown", swallow],
    ["pointerup", swallow], ["dblclick", swallow], ["contextmenu", swallow], ["keydown", onKey], ["scroll", schedule], ["resize", schedule]];
  for (const [type, handler] of events) window.addEventListener(type, handler, true);

  function finish(value) {
    result = value;
    stop();
  }
  function stop() {
    if (!active) return;
    active = false;
    if (frame) cancelAnimationFrame(frame);
    for (const [type, handler] of events) window.removeEventListener(type, handler, true);
    annotations.forEach(restore);
    host.remove();
    showCursor(false);
  }

  render();
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
