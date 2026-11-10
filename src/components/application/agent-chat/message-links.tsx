import { createContext, useCallback, useContext } from "react";
import { messageLinkTarget, splitMessageLinks } from "@/app/message-links";
import { useConfiguration } from "@/hooks/use-configuration";
import { openExternal } from "@/platform/open-external";
import type { ChatBrowser } from "./use-chat-browser";

/** Opens a link from a message; the workbench routes it by 设置 → 浏览器. */
type OpenLink = (url: string) => void;

const openSystem: OpenLink = (url) => { void openExternal(url).catch(() => undefined); };
const MessageLinkContext = createContext<OpenLink>(openSystem);
export const MessageLinkProvider = MessageLinkContext.Provider;

/**
 * The workbench's link opener: the built-in browser when 设置 → 浏览器 says
 * so for that kind of address (and the desktop app has one), else the
 * system browser.
 */
export function useMessageLinkOpener(browser: Pick<ChatBrowser, "available" | "request">, showBrowser: () => void): OpenLink {
  const { data } = useConfiguration();
  const settings = data.groups.browser;
  return useCallback((url: string) => {
    if (browser.available && messageLinkTarget(url, settings) === "internal") {
      showBrowser();
      browser.request(url);
    } else openSystem(url);
  }, [browser, settings, showBrowser]);
}

/** Message text with its web addresses as links. */
export function LinkedText({ text }: { text: string }) {
  const open = useContext(MessageLinkContext);
  return <>{splitMessageLinks(text).map((segment, index) => segment.url
    ? <a key={index} href={segment.url} onClick={(event) => { event.preventDefault(); open(segment.url!); }}
      className="text-text-primary underline decoration-text-tertiary underline-offset-2 hover:decoration-text-primary">{segment.text}</a>
    : <span key={index}>{segment.text}</span>)}</>;
}
