import { isLocalHost } from "./browser-address";

/** A run of message text, or a web address in it. */
export interface MessageSegment { text: string; url?: string }

// http(s) addresses as models write them; closing punctuation that usually
// ends the sentence (。，) or wraps the link ")" is left out of the address.
const LINK = /https?:\/\/[^\s<>"'，。；、）】」』]+/gi;
const TRAILING = /[.,;:!?)\]}'"]+$/;

/** Splits plain message text into text and links; the text is never changed. */
export function splitMessageLinks(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const raw = match[0];
    const url = raw.replace(TRAILING, "");
    const start = match.index ?? 0;
    let valid = false;
    try { valid = Boolean(new URL(url).hostname); } catch { valid = false; }
    if (!valid) continue;
    if (start > last) segments.push({ text: text.slice(last, start) });
    segments.push({ text: url, url });
    last = start + url.length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

export type LinkTarget = "system" | "internal";

/** 设置 → 浏览器: where a link opens; local dev addresses have their own choice. */
export function messageLinkTarget(url: string, settings: { webTarget?: unknown; localTarget?: unknown } | undefined): LinkTarget {
  let local = false;
  try { local = isLocalHost(new URL(url).hostname); } catch { local = false; }
  const choice = local ? settings?.localTarget : settings?.webTarget;
  return choice === "internal" ? "internal" : "system";
}
