/**
 * The calls a plugin's frame page may make through its MessagePort
 * (src-tauri/src/plugin_bridge_sdk.js on the page side). Every request is
 * checked here before the host does anything: its shape, the method, and
 * the permission the user granted. Methods of later stages answer
 * `not_available` rather than pretending.
 *
 * Page → app: `{ type: "request", id, method, params }`.
 * App → page: `{ type: "response", id, result }` or `{ ..., error: { code, message } }`,
 * and `{ type: "theme", theme }` when the app's theme changes.
 */

export const BRIDGE_VERSION = 1;

export interface BridgeContext { pluginId: string; viewId: string; permissions: string[] }
export interface BridgeTheme { mode: "light" | "dark"; variables: Record<string, string> }

/** What the host does for the page; the view supplies these. */
export interface BridgeHost {
  context: BridgeContext;
  /** The plugin's own settings values (its namespace only). */
  settings: () => Record<string, unknown>;
  openLink: (url: string) => void;
  notify: (text: string) => void;
}

export type BridgeErrorCode = "bad_request" | "unknown_method" | "permission_denied" | "not_available" | "invalid_params" | "rate_limited" | "failed";
export type BridgeResponse =
  | { type: "response"; id: number | string; result: unknown }
  | { type: "response"; id: number | string; error: { code: BridgeErrorCode; message: string } };

/** Methods a later stage opens, with the permission they will need. */
const LATER: Record<string, string> = {
  "chat.read": "读取当前对话",
  "chat.draft": "向草稿追加内容",
  "project.read": "读取当前项目",
};
const MAX_NOTIFY = 200;
const NOTIFY_GAP_MS = 2000;

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Keeps a page from flooding the app with notices: one per two seconds. */
export function notifyLimiter(gap = NOTIFY_GAP_MS, now = () => Date.now()) {
  let last = -Infinity;
  return () => {
    const time = now();
    if (time - last < gap) return false;
    last = time;
    return true;
  };
}

/** Answers one message from the page, or undefined when it is not a request at all. */
export async function handleBridgeMessage(message: unknown, host: BridgeHost, allowNotify: () => boolean = () => true): Promise<BridgeResponse | undefined> {
  if (!isObject(message) || message.type !== "request") return undefined;
  const id = message.id;
  if (!(typeof id === "number" && Number.isSafeInteger(id)) && !(typeof id === "string" && id.length > 0 && id.length <= 64)) return undefined;
  const fail = (code: BridgeErrorCode, text: string): BridgeResponse => ({ type: "response", id, error: { code, message: text } });
  const ok = (result: unknown): BridgeResponse => ({ type: "response", id, result });
  const { method, params } = message;
  if (typeof method !== "string" || method.length > 64) return fail("bad_request", "method 必须是字符串。");

  switch (method) {
    case "context.get":
      return ok({ ...host.context, permissions: [...host.context.permissions] });
    case "settings.get":
      return ok({ ...host.settings() });
    case "link.open": {
      if (!host.context.permissions.includes("link.open")) return fail("permission_denied", "这个插件没有获得“在系统浏览器中打开网址”的权限。");
      const raw = isObject(params) ? params.url : undefined;
      let url: URL | undefined;
      try { url = typeof raw === "string" && raw.length <= 2000 ? new URL(raw) : undefined; } catch { url = undefined; }
      if (!url || url.protocol !== "https:" || url.username || url.password) return fail("invalid_params", "只能打开 https 网址。");
      host.openLink(url.href);
      return ok(null);
    }
    case "ui.notify": {
      const text = isObject(params) && typeof params.text === "string" ? params.text.trim() : "";
      if (!text || text.length > MAX_NOTIFY) return fail("invalid_params", `text 必填，最多 ${MAX_NOTIFY} 个字符。`);
      if (!allowNotify()) return fail("rate_limited", "提示太频繁，两秒内只显示一条。");
      host.notify(text);
      return ok(null);
    }
    default:
      if (Object.prototype.hasOwnProperty.call(LATER, method)) return fail("not_available", `“${LATER[method]}”（${method}）还没有开放。`);
      return fail("unknown_method", `没有这个方法：${method}。`);
  }
}

/**
 * The app colors a page receives as `--np-*` variables, by the semantic
 * tokens they come from (src/styles/theme.css); the page follows the theme
 * without copying color values.
 */
export const THEME_TOKENS: Record<string, string> = {
  "--np-background": "--color-background-primary-default",
  "--np-background-secondary": "--color-background-secondary-default",
  "--np-background-hover": "--color-background-primary-hover",
  "--np-text": "--color-text-primary",
  "--np-text-secondary": "--color-text-secondary",
  "--np-text-tertiary": "--color-text-tertiary",
  "--np-text-error": "--color-text-error-primary",
  "--np-border": "--color-border-button-default",
  "--np-separator": "--color-separator-border",
  "--np-focus-ring": "--color-border-focus-ring",
  "--np-icon": "--color-foreground-icon-secondary",
  "--np-font-sans": "--font-sans",
  "--np-font-mono": "--font-mono",
};

/** Reads the current values of THEME_TOKENS through `read` (getComputedStyle in the app). */
export function bridgeTheme(dark: boolean, read: (token: string) => string): BridgeTheme {
  const variables: Record<string, string> = {};
  for (const [name, token] of Object.entries(THEME_TOKENS)) {
    const value = read(token).trim();
    if (value) variables[name] = value;
  }
  return { mode: dark ? "dark" : "light", variables };
}
