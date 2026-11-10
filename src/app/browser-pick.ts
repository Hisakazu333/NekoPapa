/**
 * An element picked in the built-in browser (src-tauri/src/browser_pick.js),
 * attached to the chat draft. It comes from page content, so every field is
 * checked and capped again here before it can reach the draft.
 */
export interface PageElement {
  id: string;
  url: string;
  title: string;
  selector: string;
  tag: string;
  text: string;
  html: string;
  htmlTruncated: boolean;
  size: { width: number; height: number };
  styles: Record<string, string>;
}

export type PickState = { kind: "pending" } | { kind: "cancelled" } | { kind: "gone" } | { kind: "picked"; element: Omit<PageElement, "id"> };

export const PAGE_ELEMENT_LIMIT = 3;
const LIMITS = { url: 2048, title: 200, selector: 500, tag: 40, text: 500, html: 4000, styleName: 40, styleValue: 200, styles: 24 };

const text = (value: unknown, limit: number) => typeof value === "string" ? value.slice(0, limit) : "";
const size = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

function webUrl(value: unknown): string | undefined {
  try {
    const url = new URL(text(value, LIMITS.url));
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Reads the picker's JSON reply (see browser_pick_result). */
export function readPickState(json: string): PickState {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { kind: "gone" }; }
  if (!raw || typeof raw !== "object") return { kind: "gone" };
  const value = raw as Record<string, unknown>;
  if (value.pending === true) return { kind: "pending" };
  if (value.cancelled === true) return { kind: "cancelled" };
  const url = webUrl(value.url);
  const tag = text(value.tag, LIMITS.tag).toLowerCase();
  if (!url || !/^[a-z][a-z0-9-]*$/.test(tag)) return { kind: "gone" };
  const rect = (value.rect && typeof value.rect === "object" ? value.rect : {}) as Record<string, unknown>;
  const styles: Record<string, string> = {};
  if (value.styles && typeof value.styles === "object") {
    for (const [name, style] of Object.entries(value.styles as Record<string, unknown>).slice(0, LIMITS.styles)) {
      if (/^[a-z-]+$/.test(name) && typeof style === "string" && style) styles[name.slice(0, LIMITS.styleName)] = style.slice(0, LIMITS.styleValue);
    }
  }
  return {
    kind: "picked",
    element: {
      url,
      title: text(value.title, LIMITS.title).trim(),
      selector: text(value.selector, LIMITS.selector),
      tag,
      text: text(value.text, LIMITS.text),
      html: text(value.html, LIMITS.html),
      htmlTruncated: value.htmlTruncated === true || text(value.html, LIMITS.html + 1).length > LIMITS.html,
      size: { width: size(rect.width), height: size(rect.height) },
      styles,
    },
  };
}

/** The draft keeps at most three elements; picking the same one again replaces it. */
export function addPageElement(current: readonly PageElement[], element: Omit<PageElement, "id">, id: string): { elements: PageElement[]; error?: string } {
  const rest = current.filter((item) => !(item.url === element.url && item.selector === element.selector));
  if (rest.length >= PAGE_ELEMENT_LIMIT) return { elements: [...current], error: `每次最多附带 ${PAGE_ELEMENT_LIMIT} 个网页元素。` };
  return { elements: [...rest, { ...element, id }] };
}

/** How an element is written into the message text. */
export function pageElementText(element: PageElement): string {
  const styles = Object.entries(element.styles).map(([name, value]) => `${name}: ${value}`).join("; ");
  return [
    `网页元素：${element.title ? `${element.title}（${element.url}）` : element.url}`,
    `选择器：${element.selector || element.tag}`,
    `尺寸：${element.size.width}×${element.size.height}`,
    element.text && `文字：${element.text}`,
    styles && `样式：${styles}`,
    `HTML${element.htmlTruncated ? `（前 ${element.html.length} 个字符）` : ""}：`,
    "```html",
    element.html,
    "```",
  ].filter(Boolean).join("\n");
}
