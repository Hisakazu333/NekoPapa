import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  RiArrowLeftLine, RiArrowRightLine, RiCloseLine, RiExternalLinkLine, RiGlobalLine, RiLoader4Line, RiRefreshLine,
} from "@remixicon/react";
import { Input } from "@/components/base/input/input";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";
import { displayBrowserAddress, normalizeBrowserAddress } from "@/app/browser-address";
import { nativeBrowser, type BrowserBounds } from "@/app/native-browser";
import { useAppOverlayOpen } from "./use-app-overlay-open";
import type { ChatBrowser } from "./use-chat-browser";

const sameBounds = (a: BrowserBounds | null, b: BrowserBounds) =>
  a !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * The chat window's browser area, opened from the 浏览器 button in the title
 * bar. The toolbar is ordinary app UI; the page itself is a native webview
 * the desktop host lays exactly over the viewport box below it. The box is
 * tracked every frame while shown (panel resize, sidebar animation, window
 * resize), and the native view is hidden whenever the box is off screen or
 * an app menu or dialog is open, since a native view always sits on top.
 */
export function ChatBrowserPanel({ browser, onClose }: { browser: ChatBrowser; onClose: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<BrowserBounds | null>(null);
  const [address, setAddress] = useState(() => browser.url ? displayBrowserAddress(browser.url) : "");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string>();
  const overlayOpen = useAppOverlayOpen();
  const hasPage = browser.available && Boolean(browser.url);
  const shown = hasPage && !overlayOpen;

  // While not editing, the bar follows the page (links, redirects, back / forward).
  const pageAddress = browser.url ? displayBrowserAddress(browser.url) : "";
  if (!editing && address !== pageAddress && browser.url) setAddress(pageAddress);

  const measure = (): BrowserBounds | null => {
    const box = viewportRef.current?.getBoundingClientRect();
    if (!box || box.width < 1 || box.height < 1) return null;
    return { x: Math.round(box.left), y: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height) };
  };

  useEffect(() => {
    if (!hasPage) return;
    if (!shown) {
      void nativeBrowser.setVisible(false).catch(() => undefined);
      return;
    }
    let frame = 0;
    let visible: boolean | null = null;
    const track = () => {
      const bounds = measure();
      if (bounds && !sameBounds(boundsRef.current, bounds)) {
        boundsRef.current = bounds;
        void nativeBrowser.setBounds(bounds).catch(() => undefined);
      }
      if (visible !== Boolean(bounds)) {
        visible = Boolean(bounds);
        void nativeBrowser.setVisible(visible).catch(() => undefined);
      }
      frame = requestAnimationFrame(track);
    };
    track();
    return () => {
      cancelAnimationFrame(frame);
      boundsRef.current = null;
      void nativeBrowser.setVisible(false).catch(() => undefined);
    };
  }, [hasPage, shown]);

  const go = (event?: FormEvent) => {
    event?.preventDefault();
    const target = normalizeBrowserAddress(address);
    if (!target.ok) { setNotice(target.reason); return; }
    setNotice(undefined);
    setEditing(false);
    setAddress(displayBrowserAddress(target.url));
    if (!browser.available) { setNotice("内置浏览器需要 NekoPapa 桌面应用。网页版不能嵌入其他网站，可以用“在新窗口打开”。"); return; }
    const bounds = measure();
    if (!bounds) { setNotice("浏览器区域太小，放大窗口后再试。"); return; }
    boundsRef.current = bounds;
    browser.open(target.url, bounds);
  };
  const popOut = () => {
    const target = normalizeBrowserAddress(editing || !browser.url ? address : browser.url);
    if (!target.ok) { setNotice(target.reason); return; }
    setNotice(undefined);
    browser.openWindow(target.url);
  };

  const problem = notice ?? browser.error;
  return <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl bg-background-secondary-default">
    <form onSubmit={go} className="flex shrink-0 items-center gap-1 p-2" aria-label="浏览器地址栏">
      <ToolbarIconButton icon={RiArrowLeftLine} label="后退" isDisabled={!hasPage} onPress={() => browser.run("back")} />
      <ToolbarIconButton icon={RiArrowRightLine} label="前进" isDisabled={!hasPage} onPress={() => browser.run("forward")} />
      {browser.loading && hasPage
        ? <ToolbarIconButton icon={RiLoader4Line} label="停止加载" onPress={() => browser.run("stop")} />
        : <ToolbarIconButton icon={RiRefreshLine} label="刷新" isDisabled={!hasPage} onPress={() => browser.run("reload")} />}
      <Input aria-label="网址" placeholder="输入网址，例如 example.com" size="small" className="min-w-0 flex-1"
        leadingIcon={RiGlobalLine} value={address} spellCheck="false"
        onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
        onChange={(next) => { setAddress(next); setEditing(true); setNotice(undefined); browser.clearError(); }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) go();
          if (event.key === "Escape" && editing) { event.preventDefault(); event.stopPropagation(); setAddress(pageAddress); setEditing(false); }
        }} />
      <ToolbarIconButton icon={RiExternalLinkLine} label="在新窗口打开" isDisabled={!address.trim() && !browser.url} onPress={popOut} />
      <ToolbarIconButton icon={RiCloseLine} label="关闭浏览器" onPress={onClose} />
    </form>
    {problem && <p role="alert" className="mx-3 mb-2 text-body-2-regular text-text-error-primary">{problem}</p>}
    {browser.title && hasPage && <p className="sr-only" aria-live="polite">{browser.title}</p>}

    <div ref={viewportRef} className="relative mx-2 mb-2 min-h-0 flex-1 overflow-hidden rounded-xl bg-background-primary-default">
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
      {hasPage && overlayOpen && <div className="flex h-full items-center justify-center px-6 text-center text-body-2-regular text-text-tertiary">菜单或对话框打开时，网页暂时隐藏。</div>}
    </div>
  </div>;
}
