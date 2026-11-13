import { PAGE_ELEMENT_HTML_SHOWN, PAGE_ELEMENT_LIMIT, pageElementText, readElement, type PageElement } from "./browser-pick";

/**
 * Elements annotated in the built-in browser travel with the user's message
 * as one data part, beside the text the user typed, so the bubble shows the
 * question and a short annotation list instead of the page's HTML. The
 * model reads them as text (pageElementsPrompt), converted on the server.
 */
export const PAGE_ELEMENTS_PART = "data-page-elements";

export type PageElementNote = Omit<PageElement, "id" | "styles">;
export interface PageElementsPart { type: typeof PAGE_ELEMENTS_PART; data: { elements: PageElementNote[] } }

const note = (element: Omit<PageElement, "id"> | PageElement): PageElementNote => ({
  url: element.url, title: element.title, selector: element.selector, tag: element.tag, text: element.text,
  html: element.html.slice(0, PAGE_ELEMENT_HTML_SHOWN),
  htmlTruncated: element.htmlTruncated || element.html.length > PAGE_ELEMENT_HTML_SHOWN,
  size: element.size, comment: element.comment, changes: element.changes,
});

export function pageElementsPart(elements: readonly PageElement[]): PageElementsPart | undefined {
  return elements.length ? { type: PAGE_ELEMENTS_PART, data: { elements: elements.slice(0, PAGE_ELEMENT_LIMIT).map(note) } } : undefined;
}

/**
 * The annotations of a message part, checked again: saved chats and request
 * bodies are not trusted. Undefined for any other part or when none is valid.
 */
export function readPageElementsPart(part: unknown): PageElementNote[] | undefined {
  if (!part || typeof part !== "object" || (part as { type?: unknown }).type !== PAGE_ELEMENTS_PART) return undefined;
  const data = (part as { data?: unknown }).data;
  const entries = data && typeof data === "object" && Array.isArray((data as { elements?: unknown }).elements) ? (data as { elements: unknown[] }).elements : [];
  const elements = entries.slice(0, PAGE_ELEMENT_LIMIT).map((entry) => {
    const size = entry && typeof entry === "object" ? (entry as { size?: unknown }).size : undefined;
    const element = readElement(entry && typeof entry === "object" ? { ...entry, rect: size } : entry);
    return element && note(element);
  }).filter((element): element is PageElementNote => element !== undefined);
  return elements.length ? elements : undefined;
}

/** What the model reads for a message's annotations. */
export function pageElementsPrompt(elements: readonly PageElementNote[]): string {
  return elements.map((element, index) => `[网页标注 ${index + 1}/${elements.length}]\n${pageElementText({ ...element, styles: {} })}`).join("\n\n");
}
