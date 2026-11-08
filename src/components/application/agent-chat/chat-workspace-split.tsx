import { useEffect, useRef, useState, type ReactNode } from "react";
import { RiArrowLeftSLine } from "@remixicon/react";
import { ResizableDivider } from "@/components/base/resizable-divider/resizable-divider";
import { MIN_CHAT_WIDTH, fitPanelWidth, panelWidthLimits, workspaceUsesOverlay } from "./chat-workspace-layout";
import "@/styles/chat-workspace-split.css";

interface ChatWorkspaceSplitProps {
  children: ReactNode;
  panel: ReactNode;
  panelOpen: boolean;
  onClose: () => void;
  /** Adds the middle edge handle while the panel is closed. */
  onOpen?: () => void;
  panelId?: string;
  panelLabel?: string;
  resizeLabel?: string;
  /** Space required by the main content before the side panel becomes an overlay. */
  mainMinWidth?: number;
}

/** Owns only the workspace geometry; panel content and visibility stay with its caller. */
export function ChatWorkspaceSplit({ children, panel, panelOpen, onClose, onOpen, panelId = "chat-auxiliary-workspace", panelLabel = "辅助工作区", resizeLabel = "调整辅助工作区宽度", mainMinWidth = MIN_CHAT_WIDTH }: ChatWorkspaceSplitProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const separatorRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  const [size, setSize] = useState({ container: 0, viewport: 0 });
  const [preferredWidth, setPreferredWidth] = useState<number | null>(null);
  const overlay = workspaceUsesOverlay(size.container, size.viewport, mainMinWidth);
  const panelWidth = fitPanelWidth(size.container, preferredWidth, mainMinWidth);
  const limits = panelWidthLimits(size.container, mainMinWidth);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => setSize({ container: root.getBoundingClientRect().width, viewport: window.innerWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!panelOpen) return;
    const previousFocus = document.activeElement;
    if (overlay) panelRef.current?.focus();
    else if (previousFocus === document.body) separatorRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      else openRef.current?.focus();
    };
  }, [panelOpen, overlay]);

  return (
    <div ref={rootRef} className="chat-workspace-split" data-overlay={overlay || undefined}>
      <div className="chat-workspace-main" inert={panelOpen && overlay ? true : undefined}>{children}</div>
      {!panelOpen && onOpen && <button ref={openRef} type="button" className="chat-workspace-open" onClick={onOpen}
        aria-label="展开辅助工作区" title="展开辅助工作区" aria-controls={panelId} aria-expanded={false}>
        <RiArrowLeftSLine aria-hidden className="size-4" />
      </button>}
      {panelOpen && <>
        {overlay ? <button type="button" className="chat-workspace-backdrop" onClick={onClose} tabIndex={-1} aria-label="关闭辅助工作区" /> : (
          <ResizableDivider ref={separatorRef} label={resizeLabel} controls={panelId}
            direction="right" value={panelWidth} min={limits.min} max={limits.max}
            preferredValue={preferredWidth} onResize={setPreferredWidth} onReset={() => setPreferredWidth(null)} />
        )}
        <div ref={panelRef} id={panelId} role="region" aria-label={panelLabel} tabIndex={-1}
          className="chat-workspace-panel" style={overlay ? undefined : { width: panelWidth }}>{panel}</div>
      </>}
    </div>
  );
}
