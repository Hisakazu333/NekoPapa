import { useId, useState } from "react";
import { ChevronDownIcon, SettingsIcon } from "@/components/foundations/icons/app-icons";
import { formatShare, formatTokens, type ThreadUsage } from "@/app/usage/thread-usage";
import { useContextWindow } from "@/hooks/use-context-window";
import { cx } from "@/utils/cx";

interface Bucket { label: string; tokens: number; swatch: string }

/** The latest reply's reported usage, split the way the provider reported it. */
function buckets(usage: ThreadUsage): Bucket[] {
  const latest = usage.latest;
  if (!latest) return [];
  const { inputTokens, outputTokens, reasoningTokens, totalTokens } = latest.usage;
  const parts = (inputTokens ?? 0) + (outputTokens ?? 0);
  const result: Bucket[] = [];
  if (parts <= totalTokens) {
    if (inputTokens) result.push({ label: "请求输入", tokens: inputTokens, swatch: "bg-chart-1" });
    if (reasoningTokens) result.push({ label: "思考", tokens: reasoningTokens, swatch: "bg-chart-4" });
    const answer = (outputTokens ?? 0) - (reasoningTokens ?? 0);
    if (answer > 0) result.push({ label: reasoningTokens ? "回复正文" : "回复输出", tokens: answer, swatch: "bg-chart-3" });
  }
  // A provider that reports only a total (or parts that do not add up) leaves it unsplit.
  const rest = parts <= totalTokens ? totalTokens - parts : totalTokens;
  if (rest > 0) result.push({ label: "未分项", tokens: rest, swatch: "bg-chart-5" });
  return result;
}

/**
 * 上下文窗口, laid out after BoardUI's agent limits card: a secondary-surface
 * card whose header row (label, used / window and the bold share, chevron)
 * folds the legend; a 6px bar split into buckets always shows beneath it;
 * unfolded, one row per bucket with its tokens and share, then the space left.
 *
 * Tokens are what the service reported for the latest reply (its input
 * carried the conversation so far). The window is the one saved with that
 * reply, else the model's window in 设置 → 模型与 API now. Without a window
 * the bar stays an empty track, shares read "—" and the card asks for one.
 */
export function ContextUsageMeter({ usage, defaultExpanded = false, onOpenModelSettings, className }: {
  usage: ThreadUsage;
  defaultExpanded?: boolean;
  onOpenModelSettings?: () => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const { used, window, ratio, source } = useContextWindow(usage);
  const parts = buckets(usage);
  const free = window !== undefined && used !== undefined ? Math.max(0, window - used) : undefined;

  return <section aria-label="上下文窗口" className={cx("flex w-full min-w-0 flex-col rounded-2xl bg-background-secondary-default px-4 pb-4 pt-2.5", className)}>
    <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded((open) => !open)}
      className="group -mx-2 flex cursor-pointer items-center justify-between gap-3 rounded-2lg px-2 py-1 text-start outline-none transition-colors duration-150 hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
      <span className="shrink-0 text-body-medium text-text-secondary">上下文窗口</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate whitespace-nowrap text-body-medium text-text-secondary tabular-nums">
          {used === undefined ? "尚无用量"
            : window !== undefined ? <>{formatTokens(used)} / {formatTokens(window)} <span className="text-text-primary">({formatShare(ratio!)})</span></>
              : <>{formatTokens(used)} / <span className="text-text-tertiary">未设置</span></>}
        </span>
        <ChevronDownIcon aria-hidden className={cx("size-4 shrink-0 text-foreground-icon-tertiary transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")} />
      </span>
    </button>
    <div role="meter" aria-label="上下文占用" aria-valuemin={0} aria-valuemax={window ?? 1}
      aria-valuenow={window !== undefined && used !== undefined ? Math.min(used, window) : 0}
      aria-valuetext={used === undefined ? "尚无用量" : window ? `${used} / ${window} Token` : `${used} Token，未设置上下文窗口`}
      className="mt-1.5 flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-chart-track">
      {window !== undefined && parts.map((part) => <span key={part.label} aria-hidden
        className={cx("h-full shrink-0 transition-[width] duration-500 ease-out motion-reduce:transition-none", part.swatch)}
        style={{ width: `${Math.min(100, part.tokens / window * 100)}%` }} />)}
    </div>
    {expanded && <div id={panelId} className="flex flex-col pt-3">
      {used === undefined
        ? <p className="py-[5px] text-body-regular text-text-tertiary">模型服务返回本对话的 Token 用量后，这里显示占用。有的服务不返回用量。</p>
        : <ul aria-label="最近一次请求的 Token" className="flex flex-col">
          {parts.map((part) => <Legend key={part.label} {...part} share={window ? part.tokens / window : undefined} />)}
          {free !== undefined && <Legend label="可用空间" tokens={free} swatch="bg-chart-track" share={free / window!} />}
        </ul>}
      {used !== undefined && window === undefined && <div className="mt-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-caption-1-regular text-text-secondary">在模型配置里填写上下文窗口后，这里按比例显示占用。</p>
        {onOpenModelSettings && <button type="button" onClick={onOpenModelSettings}
          className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-background-primary-default px-2 text-caption-1-medium text-text-primary shadow-xs outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
          <SettingsIcon className="size-3.5" aria-hidden />去填写
        </button>}
      </div>}
      {usage.replies > 0 && <p className="mt-2 text-caption-1-regular text-text-tertiary">
        本对话累计 <span className="tabular-nums">{formatTokens(usage.totalTokens)}</span> Token · {usage.replies} 次回复{usage.latest?.model ? <> · <span translate="no">{usage.latest.model}</span></> : null}
        {source === "settings" && " · 上限取自当前模型配置"}
      </p>}
    </div>}
  </section>;
}

function Legend({ swatch, label, tokens, share }: Bucket & { share?: number }) {
  return <li className="flex items-center gap-2 py-[5px]">
    <span className={cx("size-2.5 shrink-0 rounded-[3px]", swatch)} aria-hidden />
    <span className="min-w-0 flex-1 truncate text-body-regular text-text-primary">{label}</span>
    <span className="text-body-regular text-text-tertiary tabular-nums" title={`${tokens.toLocaleString("en-US")} Token`}>{formatTokens(tokens)}</span>
    <span className="w-14 text-end text-body-medium text-text-primary tabular-nums">{share === undefined ? "—" : formatShare(share)}</span>
  </li>;
}
