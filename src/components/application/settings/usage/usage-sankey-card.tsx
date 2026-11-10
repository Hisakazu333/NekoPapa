import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { sankeyBandPath, sankeyLayout } from "@/app/usage/usage-sankey-layout";
import { formatTokens, usageFlow, type UsageRange, type UsageReply } from "@/app/usage/usage-stats";
import { Select, SelectItem } from "@/components/base/select/select";

const RANGES: [UsageRange, string][] = [["7d", "近 7 天"], ["30d", "近 30 天"], ["all", "全部"]];
const HEIGHT = 240;
const NODE = 10;
const LABEL = 128;
/** Categorical chart tokens; a source keeps its colour by position. */
const color = (index: number) => `var(--color-chart-${(index % 9) + 1})`;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Where tokens went (layout after BoardUI's Pro Sankey Chart Card, drawn as
 * plain SVG with chart tokens): chat sources on the left (each project, chats
 * without a project, contacts), models on the right with their share. Bands
 * take their source's colour; hovering a band or node names its total.
 */
export function UsageSankeyCard({ replies, now }: { replies: readonly UsageReply[]; now: number }) {
  const [range, setRange] = useState<UsageRange>("30d");
  const [hover, setHover] = useState<string>();
  const [ref, width] = useWidth();
  const flow = useMemo(() => usageFlow(replies, now, range), [replies, now, range]);
  const layout = useMemo(() => sankeyLayout(flow, { height: HEIGHT }), [flow]);
  const x0 = LABEL;
  const x1 = Math.max(x0 + 80, width - LABEL);
  const share = (tokens: number) => flow.total > 0 ? Math.round((tokens / flow.total) * 100) : 0;
  const rangeLabel = RANGES.find(([key]) => key === range)![1];

  return (
    <section aria-labelledby="usage-flow-title" className="flex flex-col gap-3 rounded-2xl bg-background-secondary-default p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id="usage-flow-title" className="text-body-2-regular text-text-secondary">Token 流向</h3>
          <p className="text-title-1-semibold tabular-nums text-text-primary" title={flow.total.toLocaleString()}>{formatTokens(flow.total)}</p>
        </div>
        <Select aria-label="时间范围" size="sm" className="w-32 shrink-0" selectedKey={range}
          onSelectionChange={(key) => { if (key === "7d" || key === "30d" || key === "all") setRange(key); }}>
          {RANGES.map(([key, label]) => <SelectItem key={key} id={key}>{label}</SelectItem>)}
        </Select>
      </div>
      <div ref={ref} className="min-w-0">
        {flow.total === 0
          ? <p className="flex h-24 items-center justify-center rounded-xl bg-background-primary-default px-4 text-center text-body-2-regular text-text-tertiary">{rangeLabel}没有记录到 Token 用量。</p>
          : width > 0 && <svg width={width} height={HEIGHT + 8} role="img" aria-label={`${rangeLabel}共 ${flow.total.toLocaleString()} Token，从 ${flow.sources.length} 个来源流向 ${flow.models.length} 个模型`}
            className="block overflow-visible" onMouseLeave={() => setHover(undefined)}>
            <g transform="translate(0,4)">
              {layout.links.map((link) => {
                const active = !hover || hover === link.source || hover === link.target || hover === `${link.source}>${link.target}`;
                return <path key={`${link.source}>${link.target}`} d={sankeyBandPath(link, x0 + NODE, x1 - NODE)}
                  fill={color(link.sourceIndex)} fillOpacity={active ? 0.35 : 0.08} className="transition-[fill-opacity] duration-150"
                  onMouseEnter={() => setHover(`${link.source}>${link.target}`)}>
                  <title>{`${layout.sources[link.sourceIndex].label} → ${layout.models.find((node) => node.key === link.target)?.label} · ${link.tokens.toLocaleString()} Token`}</title>
                </path>;
              })}
              {layout.sources.map((node) => <g key={node.key} onMouseEnter={() => setHover(node.key)}>
                <rect x={x0} y={node.y} width={NODE} height={node.height} rx={3} fill={color(node.index)}>
                  <title>{`${node.label} · ${node.tokens.toLocaleString()} Token`}</title>
                </rect>
                <text x={x0 - 8} y={node.y + node.height / 2} textAnchor="end" dominantBaseline="middle" className="fill-text-primary text-caption-1-medium">
                  <tspan x={x0 - 8} dy="-0.4em">{node.label.length > 12 ? `${node.label.slice(0, 11)}…` : node.label}</tspan>
                  <tspan x={x0 - 8} dy="1.3em" className="fill-text-tertiary text-caption-2-regular">{formatTokens(node.tokens)}</tspan>
                </text>
              </g>)}
              {layout.models.map((node) => <g key={node.key} onMouseEnter={() => setHover(node.key)}>
                <rect x={x1 - NODE} y={node.y} width={NODE} height={node.height} rx={3} className="fill-chart-neutral">
                  <title>{`${node.label}${node.detail ? `（${node.detail}）` : ""} · ${node.tokens.toLocaleString()} Token`}</title>
                </rect>
                <text x={x1 + 8} y={node.y + node.height / 2} dominantBaseline="middle" className="fill-text-primary text-caption-1-medium">
                  {node.label.length > 14 ? `${node.label.slice(0, 13)}…` : node.label}
                  <tspan className="fill-text-tertiary text-caption-1-regular"> · {share(node.tokens)}%</tspan>
                </text>
              </g>)}
            </g>
          </svg>}
      </div>
      <div className="flex justify-between text-caption-1-regular text-text-tertiary">
        <span>来源</span>
        <span>模型占比</span>
      </div>
    </section>
  );
}
