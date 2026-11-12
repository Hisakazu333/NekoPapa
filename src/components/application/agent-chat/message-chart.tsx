import { useId, useState } from "react";
import { ChartColumnIcon } from "@/components/foundations/icons/app-icons";
import { formatValue, niceTicks, type ChartSpec } from "@/app/chat/chart-spec";
import { cx } from "@/utils/cx";

/** The design system's chart colors, one per series (or pie slice, cycling). */
const FILLS = ["fill-chart-1", "fill-chart-2", "fill-chart-3", "fill-chart-4", "fill-chart-5"];
const STROKES = ["stroke-chart-1", "stroke-chart-2", "stroke-chart-3", "stroke-chart-4", "stroke-chart-5"];
const SWATCHES = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
const W = 600;
const H = 260;
const PAD = { top: 12, right: 12, bottom: 36, left: 48 };

/**
 * A checked ```chart block drawn as SVG: bars, lines, areas or a pie in the
 * chart colors, with a legend, a hover title on every mark and a 数据 view
 * that lists the same numbers as a table for screen readers and copying.
 */
export function MessageChart({ chart }: { chart: ChartSpec }) {
  const [table, setTable] = useState(false);
  const titleId = useId();
  const unit = chart.unit ? ` ${chart.unit}` : "";
  return <figure className="overflow-hidden rounded-2xl border border-separator-border bg-background-primary-default">
    <figcaption className="flex min-h-9 items-center gap-2 border-b border-separator-border ps-3 pe-1.5">
      <ChartColumnIcon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      <span id={titleId} className="min-w-0 truncate text-caption-1-medium text-text-secondary">{chart.title ?? "图表"}</span>
      {chart.unit && <span className="text-caption-1-regular text-text-tertiary">单位：{chart.unit}</span>}
      <button type="button" aria-pressed={table} onClick={() => setTable((current) => !current)}
        className="ms-auto flex h-7 cursor-pointer items-center rounded-md px-2 text-caption-1-regular text-text-tertiary outline-none hover:bg-background-secondary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        {table ? "图表" : "数据"}
      </button>
    </figcaption>
    <div className="p-3">
      {table ? <ChartTable chart={chart} /> : <>
        <svg viewBox={`0 0 ${W} ${chart.type === "pie" ? 220 : H}`} role="img" aria-labelledby={titleId} className="block h-auto w-full">
          {chart.type === "pie" ? <Pie chart={chart} unit={unit} /> : <Cartesian chart={chart} unit={unit} />}
        </svg>
        {(chart.series.length > 1 || chart.type === "pie") && <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1" aria-label="图例">
          {(chart.type === "pie" ? chart.labels : chart.series.map((series) => series.name)).map((name, index) => <li key={`${name}-${index}`} className="flex items-center gap-1.5 text-caption-1-regular text-text-secondary">
            <span aria-hidden className={cx("size-2.5 rounded-[3px]", SWATCHES[index % SWATCHES.length])} />{name}
          </li>)}
        </ul>}
      </>}
    </div>
  </figure>;
}

function Cartesian({ chart, unit }: { chart: ChartSpec; unit: string }) {
  const values = chart.series.flatMap((series) => series.data);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const [low, high] = [ticks[0], ticks[ticks.length - 1]];
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (value: number) => PAD.top + plotH - ((value - low) / (high - low)) * plotH;
  const band = plotW / chart.labels.length;
  const x = (index: number) => PAD.left + band * index + band / 2;
  const every = Math.ceil(chart.labels.length / 12);
  const barW = Math.max(2, (band * 0.7) / chart.series.length);
  return <>
    {ticks.map((tick) => <g key={tick}>
      <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "stroke-chart-cursor" : "stroke-chart-track"} strokeWidth={1} />
      <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-text-tertiary text-[11px]">{formatValue(tick)}</text>
    </g>)}
    {chart.labels.map((name, index) => index % every === 0 && <text key={index} x={x(index)} y={H - PAD.bottom + 18} textAnchor="middle" className="fill-text-tertiary text-[11px]">
      {name.length > 10 ? `${name.slice(0, 9)}…` : name}</text>)}
    {chart.series.map((series, seriesIndex) => {
      if (chart.type === "bar") {
        return <g key={series.name} className={FILLS[seriesIndex]}>
          {series.data.map((value, index) => {
            const left = x(index) - (barW * chart.series.length) / 2 + barW * seriesIndex;
            const top = Math.min(y(value), y(0));
            return <rect key={index} x={left} y={top} width={barW - 1} height={Math.max(1, Math.abs(y(value) - y(0)))} rx={2}>
              <title>{`${series.name} · ${chart.labels[index]}：${formatValue(value)}${unit}`}</title>
            </rect>;
          })}
        </g>;
      }
      const points = series.data.map((value, index) => `${x(index)},${y(value)}`).join(" ");
      return <g key={series.name}>
        {chart.type === "area" && <polygon points={`${x(0)},${y(Math.max(0, low))} ${points} ${x(series.data.length - 1)},${y(Math.max(0, low))}`} className={FILLS[seriesIndex]} fillOpacity={0.18} />}
        <polyline points={points} fill="none" className={STROKES[seriesIndex]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {series.data.map((value, index) => <circle key={index} cx={x(index)} cy={y(value)} r={chart.labels.length > 24 ? 2 : 3} className={FILLS[seriesIndex]}>
          <title>{`${series.name} · ${chart.labels[index]}：${formatValue(value)}${unit}`}</title>
        </circle>)}
      </g>;
    })}
  </>;
}

function Pie({ chart, unit }: { chart: ChartSpec; unit: string }) {
  const data = chart.series[0].data;
  const total = data.reduce((sum, value) => sum + value, 0);
  const [cx0, cy0, radius] = [W / 2, 110, 96];
  let angle = -Math.PI / 2;
  return <>{data.map((value, index) => {
    const share = value / total;
    const start = angle;
    angle += share * Math.PI * 2;
    const tip = `${chart.labels[index]}：${formatValue(value)}${unit}（${(share * 100).toFixed(1)}%）`;
    if (share >= 0.9999) return <circle key={index} cx={cx0} cy={cy0} r={radius} className={FILLS[index % FILLS.length]}><title>{tip}</title></circle>;
    const point = (at: number) => `${cx0 + radius * Math.cos(at)} ${cy0 + radius * Math.sin(at)}`;
    return <path key={index} d={`M ${cx0} ${cy0} L ${point(start)} A ${radius} ${radius} 0 ${share > 0.5 ? 1 : 0} 1 ${point(angle)} Z`}
      className={cx(FILLS[index % FILLS.length], "stroke-background-primary-default")} strokeWidth={1.5}><title>{tip}</title></path>;
  })}</>;
}

function ChartTable({ chart }: { chart: ChartSpec }) {
  return <div className="max-h-[320px] overflow-auto">
    <table className="w-full border-collapse text-start text-caption-1-regular text-text-secondary">
      <thead><tr className="border-b border-separator-border">
        <th scope="col" className="py-1.5 pe-3 text-start font-medium text-text-primary">分类</th>
        {chart.series.map((series) => <th key={series.name} scope="col" className="py-1.5 pe-3 text-end font-medium text-text-primary">{series.name}</th>)}
      </tr></thead>
      <tbody>{chart.labels.map((name, index) => <tr key={`${name}-${index}`} className="border-b border-separator-border last:border-b-0">
        <th scope="row" className="py-1.5 pe-3 text-start font-normal">{name}</th>
        {chart.series.map((series) => <td key={series.name} className="py-1.5 pe-3 text-end tabular-nums">{series.data[index]}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}
