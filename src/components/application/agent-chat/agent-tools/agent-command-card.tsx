import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronRightIcon, SquareTerminalIcon } from "@/components/foundations/icons/app-icons";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import type { CommandResult } from "@/app/agent/agent-host";
import { readCommandOutput, subscribeCommandOutput } from "@/app/agent/command-output";
import { cx } from "@/utils/cx";

function status(result: CommandResult) {
  if (result.cancelled) return { label: "已停止", tone: "text-text-tertiary" };
  if (result.timedOut) return { label: "超时", tone: "text-text-error-primary" };
  return result.exitCode === 0 ? { label: "成功", tone: "text-status-lime-text" } : { label: `退出码 ${result.exitCode ?? "?"}`, tone: "text-text-error-primary" };
}

const seconds = (ms: number) => ms < 1000 ? `${ms} 毫秒` : `${(ms / 1000).toFixed(1)} 秒`;

/** What a running command has printed so far, kept scrolled to the newest line. */
function LiveOutput({ id }: { id: string }) {
  const text = useSyncExternalStore((listener) => subscribeCommandOutput(id, listener), () => readCommandOutput(id));
  const box = useRef<HTMLPreElement>(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [text]);
  if (!text) return null;
  return <pre ref={box} translate="no" aria-live="off" className="max-h-40 overflow-auto border-t border-separator-border px-3 py-2 font-mono text-caption-1-regular leading-5 whitespace-pre-wrap break-all text-text-secondary">
    {text}
  </pre>;
}

/** A command the Agent ran (or is running) in the project folder, with its captured output. */
export function AgentCommandCard({ id, command, result }: { id?: string; command: string; result?: CommandResult }) {
  const failed = result !== undefined && !(result.exitCode === 0 && !result.timedOut && !result.cancelled);
  const [open, setOpen] = useState(failed);
  const output = result ? [result.stdout, result.stderr].filter(Boolean).join(result.stdout && result.stderr ? "\n" : "") : "";
  const state = result && status(result);
  return <section aria-label="运行命令" className="overflow-hidden rounded-2xl border border-separator-border bg-background-primary-default">
    <button type="button" aria-expanded={open} disabled={!result} onClick={() => setOpen((current) => !current)}
      className="flex min-h-9 w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start outline-none hover:bg-background-secondary-default focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring disabled:cursor-default">
      {result ? <SquareTerminalIcon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden /> : <SpinnerGlyph size="xs" className="size-3.5 shrink-0" />}
      <code translate="no" className="min-w-0 flex-1 truncate font-mono text-caption-1-regular text-text-primary">{command}</code>
      {state ? <span className={cx("shrink-0 text-caption-1-medium", state.tone)}>{state.label}</span>
        : <span className="shrink-0 text-caption-1-regular text-text-tertiary">正在运行…</span>}
      {result && <span className="shrink-0 text-caption-1-regular text-text-tertiary tabular-nums">{seconds(result.durationMs)}</span>}
      {result && <ChevronRightIcon className={cx("size-3.5 shrink-0 text-text-tertiary transition-transform", open && "rotate-90")} aria-hidden />}
    </button>
    {!result && id && <LiveOutput id={id} />}
    {open && result && <div className="border-t border-separator-border">
      <pre translate="no" className="max-h-72 overflow-auto px-3 py-2 font-mono text-caption-1-regular leading-5 whitespace-pre-wrap break-all text-text-secondary">
        {output || "（没有输出）"}
      </pre>
      {result.truncated && <p className="border-t border-separator-border px-3 py-1.5 text-caption-1-regular text-text-tertiary">输出较长，只保留了每路前 64 KB。</p>}
    </div>}
  </section>;
}
