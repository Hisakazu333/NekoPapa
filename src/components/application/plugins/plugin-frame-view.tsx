import { useEffect, useMemo, useRef, useState } from "react";
import { allowPluginFrame, pluginFrameUrl } from "@/app/plugins/plugin-host";
import { BRIDGE_VERSION, bridgeTheme, handleBridgeMessage, notifyLimiter, type BridgeHost, type BridgeTheme } from "@/app/plugins/plugin-bridge";
import { settingValue } from "@/app/plugins/plugin-settings";
import type { WorkPanelViewContribution } from "@/app/plugins/slot-registry";
import { usePluginSettingValues } from "@/hooks/use-plugin-settings";
import { useThemeMode } from "@/components/application/theme/theme-toggle";
import { openExternal } from "@/platform/open-external";
import { toast } from "@/components/base/toast/toast";
import { Spinner } from "@/components/base/spinner/spinner";
import { StatusDot } from "@/components/base/badges/status-dot";

type Load = { kind: "allowing" } | { kind: "ready"; url: string } | { kind: "error"; message: string };

const currentTheme = (dark: boolean): BridgeTheme =>
  bridgeTheme(dark, (token) => getComputedStyle(document.documentElement).getPropertyValue(token));

/**
 * A plugin's own page in a sandboxed frame (docs/plugin-slots.md, stage 3).
 * The frame gets `allow-scripts` only: no same origin, so it cannot reach
 * this window, its storage or the desktop host; no forms, popups or top
 * navigation; and the host serves its files under a CSP without network.
 * On each load it receives one MessagePort with the context and the theme;
 * every call through the port is checked by handleBridgeMessage.
 */
export function PluginFrameView({ entry }: { entry: WorkPanelViewContribution }) {
  const plugin = entry.plugin!;
  const frame = entry.frame!;
  const dark = useThemeMode() === "dark";
  const [load, setLoad] = useState<Load>({ kind: "allowing" });
  const iframe = useRef<HTMLIFrameElement>(null);
  const port = useRef<MessagePort | undefined>(undefined);
  const stored = usePluginSettingValues()[plugin.pluginId];

  useEffect(() => {
    let live = true;
    setLoad({ kind: "allowing" });
    const url = pluginFrameUrl(plugin.pluginId, frame.entry);
    if (!url) { setLoad({ kind: "error", message: "清单里的页面路径不被允许。" }); return; }
    allowPluginFrame(plugin.pluginId, frame.folder).then(
      () => { if (live) setLoad({ kind: "ready", url }); },
      (error: Error) => { if (live) setLoad({ kind: "error", message: error.message }); },
    );
    return () => { live = false; };
  }, [plugin.pluginId, frame.entry, frame.folder]);

  // The latest host for the port's handler, without reconnecting the page.
  const host = useRef<BridgeHost>(undefined!);
  host.current = {
    context: { pluginId: plugin.pluginId, viewId: entry.id, permissions: frame.granted },
    settings: () => Object.fromEntries(frame.fields.map((field) => [field.key, settingValue(field, stored)])),
    openLink: (url) => { void openExternal(url).catch((error: Error) => toast.error(error.message)); },
    notify: (text) => toast.info(text, { description: `来自界面插件“${plugin.pluginName}”` }),
  };
  const allowNotify = useMemo(() => notifyLimiter(), []);

  const connect = () => {
    const target = iframe.current?.contentWindow;
    if (!target) return;
    port.current?.close();
    const channel = new MessageChannel();
    port.current = channel.port1;
    channel.port1.onmessage = (event) => {
      const reply = channel.port1;
      void handleBridgeMessage(event.data, host.current, allowNotify).then((response) => { if (response) reply.postMessage(response); });
    };
    // The frame's origin is opaque ("null"), so "*" is the only target that reaches it;
    // the message carries nothing private and the port goes to this frame alone.
    target.postMessage({ type: "nekopapa:connect", version: BRIDGE_VERSION, context: host.current.context, theme: currentTheme(dark) }, "*", [channel.port2]);
  };

  useEffect(() => { port.current?.postMessage({ type: "theme", theme: currentTheme(dark) }); }, [dark]);
  useEffect(() => () => port.current?.close(), []);

  if (load.kind === "error") return <div role="status" className="flex items-start gap-2.5 rounded-2xl bg-background-primary-default p-3">
    <StatusDot color="yellow" className="mt-1" />
    <div className="min-w-0"><p className="text-body-2-medium text-text-primary">无法打开插件页面</p>
      <p className="text-body-2-regular text-text-secondary">{load.message}</p></div>
  </div>;
  if (load.kind === "allowing") return <div className="flex flex-1 items-center justify-center"><Spinner size="sm" aria-label="正在打开插件页面" /></div>;
  return <iframe ref={iframe} key={load.url} src={load.url} title={`${entry.label}（界面插件“${plugin.pluginName}”）`}
    sandbox="allow-scripts" referrerPolicy="no-referrer" allow="" loading="lazy" onLoad={connect}
    className="min-h-0 w-full flex-1 rounded-2xl border border-separator-border bg-background-primary-default" />;
}
