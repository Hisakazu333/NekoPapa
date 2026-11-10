import { useCallback, useEffect, useRef, useState } from "react";
import { browserErrorMessage, nativeBrowser, type BrowserBounds, type BrowserCommand } from "@/app/native-browser";

export interface ChatBrowserState {
  available: boolean;
  /** The page the native view shows, as last reported by it. */
  url?: string;
  title?: string;
  loading: boolean;
  error?: string;
}

export interface ChatBrowser extends ChatBrowserState {
  open: (url: string, bounds: BrowserBounds) => void;
  run: (command: BrowserCommand) => void;
  openWindow: (url: string) => void;
  clearError: () => void;
}

/**
 * The built-in browser's session for the chat window. It outlives the
 * browser area: closing the area only hides the native view, so the page is
 * still there when the area opens again. The view is closed when the chat
 * window goes away, and a view left over from a previous load is closed on
 * mount so it can never float over the app unattended.
 */
export function useChatBrowser(): ChatBrowser {
  const available = nativeBrowser.available();
  const [state, setState] = useState<Omit<ChatBrowserState, "available">>({ loading: false });
  const mounted = useRef(true);

  const fail = useCallback((error: unknown) => {
    if (mounted.current) setState((current) => ({ ...current, loading: false, error: browserErrorMessage(error) }));
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!available) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void nativeBrowser.close().catch(() => undefined);
    void nativeBrowser.onState((event) => {
      if (!active) return;
      setState((current) => ({
        ...current,
        ...(event.url !== undefined && { url: event.url, title: event.url === current.url ? current.title : undefined }),
        ...(event.title !== undefined && { title: event.title || undefined }),
        ...(event.loading !== undefined && { loading: event.loading }),
      }));
    }).then((stop) => { if (active) unsubscribe = stop; else stop(); }, () => undefined);
    return () => {
      active = false;
      mounted.current = false;
      unsubscribe?.();
      void nativeBrowser.close().catch(() => undefined);
    };
  }, [available]);

  const open = useCallback((url: string, bounds: BrowserBounds) => {
    setState((current) => ({ ...current, url, title: undefined, loading: true, error: undefined }));
    nativeBrowser.open(url, bounds).catch(fail);
  }, [fail]);
  const run = useCallback((command: BrowserCommand) => { nativeBrowser.command(command).catch(fail); }, [fail]);
  const openWindow = useCallback((url: string) => {
    if (available) nativeBrowser.openWindow(url).catch(fail);
    else window.open(url, "_blank", "noopener,noreferrer");
  }, [available, fail]);
  const clearError = useCallback(() => setState((current) => ({ ...current, error: undefined })), []);

  return { available, ...state, open, run, openWindow, clearError };
}
