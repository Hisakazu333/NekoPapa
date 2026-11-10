import { useCallback, useEffect, useRef, useState } from "react";
import { browserErrorMessage, nativeBrowser, type BrowserBounds, type BrowserCommand } from "@/app/native-browser";
import { defaultBrowserDisplay, type BrowserDisplay } from "@/app/browser-display";
import { readPickState, type PageElement } from "@/app/browser-pick";

export interface ChatBrowserState {
  available: boolean;
  /** The page the native view shows, as last reported by it. */
  url?: string;
  title?: string;
  loading: boolean;
  error?: string;
  /** The element picker is running in the page. */
  picking: boolean;
}

export interface ChatBrowser extends ChatBrowserState {
  /** Device width / zoom; kept for the session like the page itself. */
  display: BrowserDisplay;
  setDisplay: (display: BrowserDisplay) => void;
  /** Opens `url` in `bounds`, then applies `zoom` to the new page view. */
  open: (url: string, bounds: BrowserBounds, zoom: number) => void;
  run: (command: BrowserCommand) => void;
  openWindow: (url: string) => void;
  clearError: () => void;
  /** Starts or stops picking an element in the page. */
  togglePick: () => void;
}

/**
 * The built-in browser's session for the chat window. It outlives the
 * browser area: closing the area only hides the native view, so the page is
 * still there when the area opens again. The view is closed when the chat
 * window goes away, and a view left over from a previous load is closed on
 * mount so it can never float over the app unattended.
 */
const PICK_POLL_MS = 250;

/** `onPick` receives an element picked in the page (validated in browser-pick.ts). */
export function useChatBrowser(onPick: (element: Omit<PageElement, "id">) => void): ChatBrowser {
  const available = nativeBrowser.available();
  const [state, setState] = useState<Omit<ChatBrowserState, "available">>({ loading: false, picking: false });
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [display, setDisplay] = useState<BrowserDisplay>(defaultBrowserDisplay);
  const mounted = useRef(true);

  const fail = useCallback((error: unknown) => {
    if (mounted.current) setState((current) => ({ ...current, loading: false, picking: false, error: browserErrorMessage(error) }));
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

  const open = useCallback((url: string, bounds: BrowserBounds, zoom: number) => {
    setState((current) => ({ ...current, url, title: undefined, loading: true, error: undefined }));
    // A view created by this call starts at 100%; apply the zoom once it exists.
    nativeBrowser.open(url, bounds).then(() => nativeBrowser.setZoom(zoom)).catch(fail);
  }, [fail]);
  const run = useCallback((command: BrowserCommand) => { nativeBrowser.command(command).catch(fail); }, [fail]);
  const openWindow = useCallback((url: string) => {
    if (available) nativeBrowser.openWindow(url).catch(fail);
    else window.open(url, "_blank", "noopener,noreferrer");
  }, [available, fail]);
  const clearError = useCallback(() => setState((current) => ({ ...current, error: undefined })), []);
  const stateRef = useRef(state);
  stateRef.current = state;
  const togglePick = useCallback(() => {
    const current = stateRef.current;
    if (!available || !current.url) return;
    const picking = !current.picking;
    setState((latest) => ({ ...latest, picking, error: undefined }));
    nativeBrowser.pick(picking).catch(fail);
  }, [available, fail]);

  // While picking, ask the page for its result a few times a second. A new
  // page drops the picker, which reads as "gone" and ends picking.
  useEffect(() => {
    if (!state.picking) return;
    let stopped = false;
    const timer = window.setInterval(() => {
      nativeBrowser.pickResult().then((json) => {
        if (stopped) return;
        const result = readPickState(json);
        if (result.kind === "pending") return;
        if (result.kind === "picked") result.elements.forEach((element) => onPickRef.current(element));
        setState((current) => ({ ...current, picking: false }));
      }, (error: unknown) => {
        if (!stopped) setState((current) => ({ ...current, picking: false, error: browserErrorMessage(error) }));
      });
    }, PICK_POLL_MS);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [state.picking]);

  return { available, ...state, display, setDisplay, open, run, openWindow, clearError, togglePick };
}
