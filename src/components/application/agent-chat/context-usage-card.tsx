import { SettingsIcon } from "@/components/foundations/icons/app-icons";
import { Button } from "@/components/base/buttons/button";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { contextUsageRatio, formatTokens, type ThreadUsage } from "@/app/usage/thread-usage";
import { cx } from "@/utils/cx";
import { WorkPanelSection } from "./tools/work-panel-section";

const percent = (ratio: number) => `${(ratio * 100).toFixed(ratio > 0 && ratio < 0.1 ? 1 : 0)}%`;

interface Bucket { label: string; tokens: number; swatch: string }

export function ContextUsageCard({ usage, onOpenModelSettings }: {
  usage: ThreadUsage;
  onOpenModelSettings?: () => void;
}) {
  const openSettings = useWorkspaceSettings();
  const latest = usage.latest;
  const window = latest?.contextWindow;
  const used = latest?.usage.totalTokens;
  const ratio = contextUsageRatio(latest);
  const buckets: Bucket[] = [];
  if (latest) {
    const { inputTokens, outputTokens, totalTokens } = latest.usage;
    const parts = (inputTokens ?? 0) + (outputTokens ?? 0);
    if (parts <= totalTokens) {
      if (inputTokens !== undefined) buckets.push({ label: "请求输入", tokens: inputTokens, swatch: "bg-chart-1" });
      if (outputTokens !== undefined) buckets.push({ label: "回复输出", tokens: outputTokens, swatch: "bg-chart-3" });
    }
    const unclassified = parts <= totalTokens ? totalTokens - parts : totalTokens;
    if (unclassified > 0 || buckets.length === 0) buckets.push({ label: "未分项", tokens: unclassified, swatch: "bg-chart-5" });
  }
  const free = window !== undefined && used !== undefined ? Math.max(0, window - used) : undefined;
  const reading = used === undefined ? "尚无用量" : ratio === undefined ? `${formatTokens(used)} Token` : percent(ratio);

  return <WorkPanelSection title="上下文窗口" summary={reading} defaultExpanded>
    <div className="flex flex-col gap-2.5">
      {latest && used !== undefined ? <>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <span className="text-caption-1-medium text-text-secondary">最近一次有用量的回复</span>
          <span title={latest.model} translate="no" className="min-w-0 truncate text-caption-1-regular text-text-secondary">{latest.model}</span>
        </div>
        {window !== undefined && <>
          <p className="text-body-2-medium text-text-primary tabular-nums">{formatTokens(used)} / {formatTokens(window)} Token</p>
          <div role="meter" aria-label="上次请求上下文占用" aria-valuemin={0} aria-valuemax={window} aria-valuenow={Math.min(used, window)}
            aria-valuetext={`${used} / ${window} Token`} className="flex h-1.5 w-full overflow-hidden rounded-full bg-chart-track">
            {buckets.map((bucket) => <span key={bucket.label} aria-hidden className={cx("h-full shrink-0", bucket.swatch)}
              style={{ width: `${bucket.tokens / Math.max(window, used) * 100}%` }} />)}
          </div>
        </>}
        <ul className="flex flex-col gap-1">
          {buckets.map((bucket) => <UsageRow key={bucket.label} {...bucket} window={window} />)}
          {free !== undefined && <UsageRow swatch="bg-chart-track" label="剩余参考" tokens={free} window={window} />}
        </ul>
        {window !== undefined && <p className="text-caption-1-regular text-text-secondary">按该次回复的 Token 与当时配置的上限计算，供参考。</p>}
      </> : <p className="text-body-2-regular text-text-secondary">模型服务返回 Token 用量后，这里会显示请求输入与回复输出。</p>}
      {window === undefined && <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-32 flex-1 text-caption-1-regular text-text-secondary">在模型配置填写上下文窗口，收到新回复后可查看占用比例。</p>
        <Button size="small" variant="secondary" leadingIcon={SettingsIcon} onClick={onOpenModelSettings ?? (() => openSettings("model"))}>模型与 API</Button>
      </div>}
      {usage.replies > 0 && <p className="border-t border-separator-border pt-2 text-caption-1-regular text-text-secondary">
        本对话累计 {formatTokens(usage.totalTokens)} Token · {usage.replies} 次有用量记录的回复
      </p>}
    </div>
  </WorkPanelSection>;
}

function UsageRow({ swatch, label, tokens, window }: Bucket & { window?: number }) {
  return <li className="flex items-center gap-2 text-caption-1-regular tabular-nums">
    <span className={cx("size-2 shrink-0 rounded-sm", swatch)} aria-hidden />
    <span className="min-w-0 flex-1 text-text-secondary">{label}</span>
    <span className="shrink-0 text-text-primary" title={tokens.toLocaleString()}>{formatTokens(tokens)}</span>
    {window !== undefined && <span className="w-14 shrink-0 text-end text-text-secondary">{percent(tokens / window)}</span>}
  </li>;
}
