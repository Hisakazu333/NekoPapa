import { useCallback, useEffect, useRef, useState } from "react";
import { DeleteIcon, RotateCcwIcon, SquareTerminalIcon } from "@/components/foundations/icons/app-icons";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { terminalAvailable, terminalFor, type TerminalSession, type TerminalShell } from "@/app/terminal-session";
import { useConfiguration } from "@/hooks/use-configuration";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";
import { Button } from "@/components/base/buttons/button";
import { ToolPanelMessage } from "./tool-panel-frame";
import { tokenCss } from "@/platform/token-color";

type State = { kind: "starting" } | { kind: "running" } | { kind: "exited" } | { kind: "error"; message: string };

function themeFromTokens(): ITheme {
  return {
    background: tokenCss("background-secondary-default", "#f5f5f5"),
    foreground: tokenCss("text-primary", "#171717"),
    cursor: tokenCss("text-primary", "#171717"),
    cursorAccent: tokenCss("background-secondary-default", "#f5f5f5"),
    selectionBackground: tokenCss("background-primary-hover", "#e5e5e5"),
  };
}

/**
 * 终端: a login shell in the project's primary folder (or the home folder
 * when the chat has no project), run by the desktop host. The shell keeps
 * running when the panel closes; reopening shows its recent output again.
 */
export function TerminalView({ cwd, onActions }: { cwd?: string; onActions: (actions: React.ReactNode) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>({ kind: "starting" });
  const [generation, setGeneration] = useState(0);
  const session = useRef<TerminalSession>(undefined);
  const term = useRef<Terminal>(undefined);
  // 设置 → 编辑器与终端: the shell applies to new sessions, the size at once.
  const { data } = useConfiguration();
  const shell = String(data.groups.editor?.shell ?? "system") as TerminalShell;
  const fontSize = Number(data.groups.editor?.fontSize) || 13;
  const fontRef = useRef(fontSize);
  const fitRef = useRef<FitAddon>(undefined);
  fontRef.current = fontSize;

  const restart = useCallback(async () => {
    await session.current?.close();
    setGeneration((value) => value + 1);
  }, []);

  useEffect(() => {
    onActions(<>
      <ToolbarIconButton icon={DeleteIcon} label="清屏" onPress={() => term.current?.clear()} isDisabled={state.kind !== "running"} />
      <ToolbarIconButton icon={RotateCcwIcon} label="重新启动终端" onPress={() => void restart()} isDisabled={state.kind === "starting"} />
    </>);
  }, [onActions, restart, state.kind]);

  useEffect(() => {
    const element = host.current;
    if (!element || !terminalAvailable()) return;
    const terminal = new Terminal({
      fontFamily: getComputedStyle(element).fontFamily,
      fontSize: fontRef.current,
      lineHeight: 1.25,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: false,
      theme: themeFromTokens(),
    });
    const fit = new FitAddon();
    fitRef.current = fit;
    terminal.loadAddon(fit);
    terminal.open(element);
    fit.fit();
    term.current = terminal;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    setState({ kind: "starting" });

    terminalFor(cwd, terminal.cols, terminal.rows, shell).then((live) => {
      if (disposed) return;
      session.current = live;
      terminal.write(live.replay());
      if (live.exited()) { setState({ kind: "exited" }); return; }
      live.resize(terminal.cols, terminal.rows);
      unsubscribe = live.subscribe((event) => {
        if (event.kind === "output") terminal.write(event.data);
        else setState({ kind: "exited" });
      });
      setState({ kind: "running" });
      terminal.focus();
    }, (error: unknown) => {
      if (!disposed) setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    });

    const input = terminal.onData((data) => session.current?.write(data));
    const resized = terminal.onResize(({ cols, rows }) => session.current?.resize(cols, rows));
    const observer = new ResizeObserver(() => { if (element.clientWidth > 0) fit.fit(); });
    observer.observe(element);
    // Light / dark switches change the tokens on <html>.
    const themeWatch = new MutationObserver(() => { terminal.options.theme = themeFromTokens(); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      disposed = true;
      unsubscribe?.();
      input.dispose();
      resized.dispose();
      observer.disconnect();
      themeWatch.disconnect();
      terminal.dispose();
      term.current = undefined;
      session.current = undefined;
    };
  }, [cwd, generation, shell]);

  useEffect(() => {
    const terminal = term.current;
    if (!terminal || terminal.options.fontSize === fontSize) return;
    terminal.options.fontSize = fontSize;
    fitRef.current?.fit();
  }, [fontSize]);

  if (!terminalAvailable()) return <ToolPanelMessage icon={SquareTerminalIcon} title="终端需要桌面应用"
    detail="终端在本机运行 shell，只能在 NekoPapa 桌面应用中使用；浏览器页面不能启动本机进程。" />;

  return <div className="relative flex min-h-0 flex-1 flex-col">
    <div ref={host} translate="no" className="min-h-0 flex-1 px-3 pb-3 font-mono" />
    {(state.kind === "exited" || state.kind === "error") && <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl bg-background-primary-default px-3 py-2 shadow-sm">
      <p role={state.kind === "error" ? "alert" : "status"} className={state.kind === "error" ? "min-w-0 flex-1 text-body-2-regular text-text-error-primary" : "min-w-0 flex-1 text-body-2-regular text-text-secondary"}>
        {state.kind === "error" ? `无法启动终端：${state.message}` : "Shell 已退出。"}
      </p>
      <Button size="small" leadingIcon={RotateCcwIcon} onClick={() => void restart()}>重新启动</Button>
    </div>}
  </div>;
}
