import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  RiArrowLeftLine, RiArrowRightLine, RiCloseLine, RiCursorLine, RiExternalLinkLine, RiGlobalLine, RiLayoutRightLine,
  RiLayoutTopLine, RiRefreshLine, RiStopCircleLine,
} from "@remixicon/react";
import { Input } from "@/components/base/input/input";
import { ProgressTrack } from "@/components/base/progress/progress";
import { cx } from "@/utils/cx";
import { ToolbarIconButton, toolbarIconButtonClass, toolbarIconClass } from "@/components/application/dashboard/toolbar-icon-button";
import { displayBrowserAddress, normalizeBrowserAddress } from "@/app/browser-address";
import { nativeBrowser, type BrowserBounds } from "@/app/native-browser";
import { browserFrame, type BrowserFrame } from "@/app/browser-display";
import { ChatBrowserDisplayMenu } from "./chat-browser-display-menu";
import { useAppOverlayOpen } from "./use-app-overlay-open";
import type { ChatBrowser } from "./use-chat-browser";

const sameBounds = (a: BrowserBounds | null, b: BrowserBounds) =>
  a !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const frameChanged = (a: BrowserFrame | undefined, b: BrowserFrame) => !a || a.layoutWidth !== b.layoutWidth || a.width !== b.width;

/**
 * The chat window's browser area, opened from the 浏览器 button in the title
 * bar. The toolbar is ordinary app UI; the page itself is a native webview
 * the desktop host lays exactly over the viewport box below it. The box is
 * followed while it moves (panel resize, sidebar animation, window resize),
 * and the native view is hidden whenever the box is off screen or
 * an app menu or dialog is open, since a native view always sits on top.
 *
 * It shows in one of two places (`placement`): beside the chat, or as a
 * title-bar tab across the work area. The move button switches place on a
 * click and can be dragged to the other place; `suspended` hides the page
 * during a drag so the drop targets underneath stay visible.
 */
export function ChatBrowserPanel({ browser, onClose, placement, onMove, onMovePointerDown, suspended = false }: {
  browser: ChatBrowser;
  onClose: () => void;
  placement: "side" | "tab";
  /** Keyboard activation of the move button; pointer presses go to `onMovePointerDown`. */
  onMove: () => void;
  onMovePointerDown: (event: ReactPointerEvent) => void;
  suspended?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<BrowserBounds | null>(null);
  const zoomRef = useRef<number | null>(null);
  const [frame, setFrame] = useState<BrowserFrame>();
  const displayRef = useRef(browser.display);
  displayRef.current = browser.display;
  const [address, setAddress] = useState(() => browser.url ? displayBrowserAddress(browser.url) : "");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string>();
  const overlayOpen = useAppOverlayOpen();
  const hasPage = browser.available && Boolean(browser.url);
  const shown = hasPage && !overlayOpen && !suspended;

  // While not editing, the bar follows the page (links, redirects, back / forward).
  const pageAddress = browser.url ? displayBrowserAddress(browser.url) : "";
  if (!editing && address !== pageAddress && browser.url) setAddress(pageAddress);

  // The native view's rectangle and zoom for the current display mode: a
  // narrow device is a centred column inside the viewport box.
  const measure = (): { bounds: BrowserBounds; frame: BrowserFrame } | null => {
    const box = viewportRef.current?.getBoundingClientRect();
    if (!box || box.width < 1 || box.height < 1) return null;
    const next = browserFrame(box, displayRef.current);
    return { frame: next, bounds: { x: Math.round(box.left) + next.x, y: Math.round(box.top), width: next.width, height: next.height } };
  };

  useEffect(() => {
    if (!hasPage) return;
    if (!shown) {
      void nativeBrowser.setVisible(false).catch(() => undefined);
      return;
    }
    let raf = 0;
    let until = 0;
    let lastFrame: BrowserFrame | undefined;
    let visible: boolean | null = null;
    const sync = () => {
      const measured = measure();
      if (measured && !sameBounds(boundsRef.current, measured.bounds)) {
        boundsRef.current = measured.bounds;
        void nativeBrowser.setBounds(measured.bounds).catch(() => undefined);
      }
      if (measured && zoomRef.current !== measured.frame.zoom) {
        zoomRef.current = measured.frame.zoom;
        setFrame(measured.frame);
        void nativeBrowser.setZoom(measured.frame.zoom).catch(() => undefined);
      } else if (measured && frameChanged(lastFrame, measured.frame)) setFrame(measured.frame);
      lastFrame = measured?.frame;
      if (visible !== Boolean(measured)) {
        visible = Boolean(measured);
        void nativeBrowser.setVisible(visible).catch(() => undefined);
      }
    };
    // Follow the box frame by frame only while something is moving (a
    // resize, a divider drag, the sidebar's animation), then go idle, so an
    // open page costs the app nothing while it just sits there.
    const loop = () => {
      sync();
      raf = performance.now() < until ? requestAnimationFrame(loop) : 0;
    };
    const wake = () => {
      until = performance.now() + 400;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    sync();
    const resize = new ResizeObserver(wake);
    if (viewportRef.current) resize.observe(viewportRef.current);
    resize.observe(document.documentElement);
    window.addEventListener("resize", wake);
    document.addEventListener("transitionrun", wake, true);
    document.addEventListener("transitionend", wake, true);
    document.addEventListener("pointermove", onDrag, true);
    function onDrag(event: PointerEvent) { if (event.buttons) wake(); }
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      window.removeEventListener("resize", wake);
      document.removeEventListener("transitionrun", wake, true);
      document.removeEventListener("transitionend", wake, true);
      document.removeEventListener("pointermove", onDrag, true);
      boundsRef.current = null;
      zoomRef.current = null;
      void nativeBrowser.setVisible(false).catch(() => undefined);
    };
  // A new display mode re-runs this, which re-applies bounds and zoom at once.
  }, [hasPage, shown, browser.display]);

  // ⇧⌘S (⇧Ctrl+S elsewhere) toggles the picker while the app has focus;
  // once the page has focus, Esc in the page cancels it.
  const togglePick = browser.togglePick;
  useEffect(() => {
    if (!hasPage) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.shiftKey && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        togglePick();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPage, togglePick]);

  const go = (event?: FormEvent) => {
    event?.preventDefault();
    const target = normalizeBrowserAddress(address);
    if (!target.ok) { setNotice(target.reason); return; }
    setNotice(undefined);
    setEditing(false);
    setAddress(displayBrowserAddress(target.url));
    if (!browser.available) { setNotice("内置浏览器需要 NekoPapa 桌面应用。网页版不能嵌入其他网站，可以用“在新窗口打开”。"); return; }
    const measured = measure();
    if (!measured) { setNotice("浏览器区域太小，放大窗口后再试。"); return; }
    boundsRef.current = measured.bounds;
    zoomRef.current = measured.frame.zoom;
    setFrame(measured.frame);
    browser.open(target.url, measured.bounds, measured.frame.zoom);
  };
  const popOut = () => {
    const target = normalizeBrowserAddress(editing || !browser.url ? address : browser.url);
    if (!target.ok) { setNotice(target.reason); return; }
    setNotice(undefined);
    browser.openWindow(target.url);
  };

  const problem = notice ?? browser.error;
  return <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl bg-background-secondary-default">
    <form onSubmit={go} className="relative flex shrink-0 items-center gap-1 p-2" aria-label="浏览器地址栏">
      <ToolbarIconButton icon={RiArrowLeftLine} label="后退" isDisabled={!hasPage} onPress={() => browser.run("back")} />
      <ToolbarIconButton icon={RiArrowRightLine} label="前进" isDisabled={!hasPage} onPress={() => browser.run("forward")} />
      {browser.loading && hasPage
        ? <ToolbarIconButton icon={RiStopCircleLine} label="停止加载" onPress={() => browser.run("stop")} />
        : <ToolbarIconButton icon={RiRefreshLine} label="刷新" isDisabled={!hasPage} onPress={() => browser.run("reload")} />}
      <Input aria-label="网址" placeholder="输入网址，例如 example.com" size="small" className="min-w-0 flex-1"
        leadingIcon={RiGlobalLine} value={address} spellCheck="false"
        onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
        onChange={(next) => { setAddress(next); setEditing(true); setNotice(undefined); browser.clearError(); }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) go();
          if (event.key === "Escape" && editing) { event.preventDefault(); event.stopPropagation(); setAddress(pageAddress); setEditing(false); }
        }} />
      <button type="button" aria-pressed={browser.picking} disabled={!hasPage} onClick={togglePick}
        aria-keyshortcuts="Meta+Shift+S" aria-label={browser.picking ? "停止选择元素" : "选择元素"}
        title={browser.picking ? "停止选择元素（Esc）" : "选择元素（⇧⌘S）：把网页元素的 HTML、样式和选择器加入对话"}
        className={cx(toolbarIconButtonClass, browser.picking && "bg-background-primary-hover text-text-primary")}>
        <RiCursorLine className={toolbarIconClass} aria-hidden />
      </button>
      <ChatBrowserDisplayMenu display={browser.display} frame={hasPage ? frame : undefined} onChange={browser.setDisplay} />
      <ToolbarIconButton icon={RiExternalLinkLine} label="在新窗口打开" isDisabled={!address.trim() && !browser.url} onPress={popOut} />
      <button type="button" aria-label={placement === "side" ? "移到标题栏标签" : "放回侧边"}
        title={placement === "side" ? "移到标题栏标签（也可以拖到标题栏）" : "放回侧边（也可以拖动标签到右侧）"}
        onPointerDown={onMovePointerDown} onClick={(event) => { if (event.detail === 0) onMove(); }}
        className={cx(toolbarIconButtonClass, "touch-none")}>
        {placement === "side" ? <RiLayoutTopLine className={toolbarIconClass} aria-hidden /> : <RiLayoutRightLine className={toolbarIconClass} aria-hidden />}
      </button>
      <ToolbarIconButton icon={RiCloseLine} label="关闭浏览器" onPress={onClose} />
      {/* Loading: a sweep along the toolbar's lower edge, outside the native
          page view so it is never covered and never shifts the page. */}
      {browser.loading && hasPage && <ProgressTrack percentage={0} isIndeterminate size="sm" className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5" />}
    </form>
    {browser.loading && hasPage && <span role="status" className="sr-only">正在加载网页</span>}
    {browser.picking && <p role="status" className="mx-3 mb-2 text-body-2-regular text-text-secondary">在网页中点选一个元素，加入对话输入框；按 Esc 或再次点按钮取消。</p>}
    {problem && <p role="alert" className="mx-3 mb-2 text-body-2-regular text-text-error-primary">{problem}</p>}
    {browser.title && hasPage && <p className="sr-only" aria-live="polite">{browser.title}</p>}

    {/* A device narrower than the area sits as a column on a tinted ground. */}
    <div ref={viewportRef} className={cx("relative mx-2 mb-2 min-h-0 flex-1 overflow-hidden rounded-xl",
      hasPage && frame && frame.x > 0 ? "bg-background-tertiary-default" : "bg-background-primary-default")}>
      {!hasPage && <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
        <RiGlobalLine className="mb-2 size-8 text-foreground-icon-tertiary" aria-hidden />
        {browser.available ? <>
          <p className="text-body-medium text-text-primary">输入网址打开网页</p>
          <p className="max-w-[320px] text-body-2-regular text-text-secondary">也可以打开本机正在运行的页面，例如 localhost:5173。</p>
        </> : <>
          <p className="text-body-medium text-text-primary">内置浏览器需要 NekoPapa 桌面应用</p>
          <p className="max-w-[320px] text-body-2-regular text-text-secondary">网页版不能把其他网站嵌入页面，输入网址后可以用“在新窗口打开”在浏览器标签页中查看。</p>
        </>}
      </div>}
      {hasPage && !shown && <div className="flex h-full items-center justify-center px-6 text-center text-body-2-regular text-text-tertiary">
        {suspended ? "拖动时网页暂时隐藏，松开后恢复。" : "菜单或对话框打开时，网页暂时隐藏。"}
      </div>}
    </div>
  </div>;
}
