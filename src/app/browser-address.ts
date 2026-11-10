/**
 * Turns what was typed in the built-in browser's address bar into a web URL.
 * Only http(s) pages open. A bare host gets https://, except local hosts
 * (localhost, 127.0.0.1, *.localhost, *.test), which get http:// so local dev
 * servers open as typed. There is no search engine yet, so words that are not
 * an address are refused with a reason instead of being sent anywhere.
 */
export type BrowserAddress = { ok: true; url: string } | { ok: false; reason: string };

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const HOST = /^(\[[0-9a-f:]+\]|[a-z0-9-]+(\.[a-z0-9-]+)*)(:\d{1,5})?([/?#].*)?$/i;

function isLocalHost(host: string) {
  const name = host.replace(/^\[|\]$/g, "").toLowerCase();
  return name === "localhost" || name === "::1" || /^127(\.\d{1,3}){3}$/.test(name) || name.endsWith(".localhost") || name.endsWith(".test");
}

function webUrl(text: string): BrowserAddress {
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "只能打开 http 或 https 网页。" };
    if (!url.hostname) return { ok: false, reason: "网址缺少域名。" };
    return { ok: true, url: url.href };
  } catch {
    return { ok: false, reason: "网址格式不正确。" };
  }
}

export function normalizeBrowserAddress(input: string): BrowserAddress {
  const text = input.trim();
  if (!text) return { ok: false, reason: "请输入网址。" };
  if (/\s/.test(text)) return { ok: false, reason: "请输入网址，例如 example.com。暂不支持搜索。" };
  const host = HOST.exec(text);
  if (host) {
    const name = host[1];
    if (isLocalHost(name)) return webUrl(`http://${text}`);
    // A single word ("notes") is not a site; a host needs a dot.
    if (!name.includes(".")) return { ok: false, reason: "请输入完整网址，例如 example.com。暂不支持搜索。" };
    return webUrl(`https://${text}`);
  }
  if (SCHEME.test(text)) return webUrl(text);
  return { ok: false, reason: "网址格式不正确。" };
}

/** What the address bar shows for a page: the URL without a trailing "/" on a bare origin. */
export function displayBrowserAddress(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" && !parsed.search && !parsed.hash ? parsed.origin : parsed.href;
  } catch {
    return url;
  }
}

/** A short name for the open page: its title, else its host, else 浏览器. */
export function browserTabLabel(url: string | undefined, title: string | undefined): string {
  if (title?.trim()) return title.trim();
  try {
    return url ? new URL(url).hostname || "浏览器" : "浏览器";
  } catch {
    return "浏览器";
  }
}
