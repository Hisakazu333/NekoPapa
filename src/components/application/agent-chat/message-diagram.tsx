import { useEffect, useId, useRef, useState } from "react";
import { WorkflowIcon } from "@/components/foundations/icons/app-icons";
import { useThemeMode } from "@/components/application/theme/theme-toggle";
import { MessageCodeBlock } from "./message-code-block";

type Rendered = { source: string; theme: string; svg: string } | { source: string; theme: string; error: string };
let queue: Promise<unknown> = Promise.resolve();

/**
 * A finished ```mermaid block drawn as a diagram. Mermaid loads only when the
 * first diagram appears and runs in strict mode (no scripts, no HTML labels,
 * links not clickable); renders are queued because Mermaid keeps global
 * state. A diagram that does not parse is shown as its code with Mermaid's
 * reason; 代码 switches any diagram to its source.
 */
export function MessageDiagram({ code }: { code: string }) {
  const theme = useThemeMode();
  const id = `diagram-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [rendered, setRendered] = useState<Rendered>();
  const [showCode, setShowCode] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    const run = async () => {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: theme === "dark" ? "dark" : "default", fontFamily: "inherit", htmlLabels: false });
      try {
        const { svg } = await mermaid.render(id, code);
        return { source: code, theme, svg };
      } catch (error) {
        document.getElementById(`d${id}`)?.remove();
        return { source: code, theme, error: error instanceof Error ? error.message.split("\n")[0] : "图表语法有误。" };
      }
    };
    const next = queue.then(run, run);
    queue = next;
    void next.then((result) => { if (live) setRendered(result); }, () => { if (live) setRendered({ source: code, theme, error: "无法加载图表组件。" }); });
    return () => { live = false; };
  }, [code, id, theme]);

  const current = rendered?.source === code ? rendered : undefined;
  useEffect(() => {
    if (host.current && current && "svg" in current) host.current.innerHTML = current.svg;
  }, [current]);

  if (current && "error" in current) return <MessageCodeBlock lang="mermaid" code={code} complete notice={`图表没有画出来：${current.error}`} />;
  const toggle = <button type="button" aria-pressed={showCode} onClick={() => setShowCode((value) => !value)}
    className="flex h-7 cursor-pointer items-center rounded-md px-2 text-caption-1-regular text-text-tertiary outline-none hover:bg-background-secondary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
    {showCode ? "图表" : "代码"}</button>;
  if (showCode) return <MessageCodeBlock lang="mermaid" code={code} complete actions={toggle} />;
  return <figure className="overflow-hidden rounded-2xl border border-separator-border bg-background-primary-default">
    <figcaption className="flex h-9 items-center gap-2 border-b border-separator-border ps-3 pe-1.5">
      <WorkflowIcon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      <span className="min-w-0 truncate text-caption-1-medium text-text-secondary">图表</span>
      {!current && <span className="text-caption-1-regular text-text-tertiary">正在绘制…</span>}
      <span className="ms-auto">{toggle}</span>
    </figcaption>
    <div ref={host} role="img" aria-label="Mermaid 图表" className="flex max-h-[560px] justify-center overflow-auto p-3 [&_svg]:h-auto [&_svg]:max-w-full" />
  </figure>;
}
