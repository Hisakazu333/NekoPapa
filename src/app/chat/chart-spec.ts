/**
 * Charts in a reply: a fenced ```chart block whose body is JSON. The model
 * writes the numbers; NekoPapa checks them and draws the chart with its own
 * components and chart colors (message-chart.tsx). Nothing else in the block
 * is run or loaded. A block that does not check out is shown as code with
 * the reasons, never as a guessed chart.
 *
 *   { "type": "bar" | "line" | "area" | "pie", "title"?: string, "unit"?: string,
 *     "labels": string[], "series": [{ "name": string, "data": number[] }] }
 *
 * or the one-series shorthand `{ "type", "data": [{ "label", "value" }] }`.
 */

export type ChartType = "bar" | "line" | "area" | "pie";
export interface ChartSeries { name: string; data: number[] }
export interface ChartSpec { type: ChartType; title?: string; unit?: string; labels: string[]; series: ChartSeries[] }
export type ChartCheck = { ok: true; chart: ChartSpec } | { ok: false; errors: string[] };

export const CHART_LANGS = ["chart"] as const;
export const CHART_LIMITS = { series: 5, labels: 60, pieSlices: 12, text: 60 };
const TYPES: readonly ChartType[] = ["bar", "line", "area", "pie"];

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const label = (value: unknown) => (typeof value === "string" || typeof value === "number") && String(value).trim() ? String(value).trim().slice(0, CHART_LIMITS.text) : undefined;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function checkChart(source: string): ChartCheck {
  let value: unknown;
  try { value = JSON.parse(source); } catch { return { ok: false, errors: ["图表内容不是有效的 JSON。"] }; }
  if (!isObject(value)) return { ok: false, errors: ["图表内容必须是一个对象。"] };
  const errors: string[] = [];
  const type = TYPES.find((candidate) => candidate === value.type);
  if (!type) errors.push(`type 只能是 ${TYPES.join("、")}。`);
  const title = value.title === undefined ? undefined : label(value.title);
  const unit = value.unit === undefined ? undefined : label(value.unit);

  let labels: string[] = [];
  let series: ChartSeries[] = [];
  if (Array.isArray(value.data) && value.series === undefined) {
    const points = value.data.map((point) => isObject(point) && label(point.label) && finite(point.value) ? { label: label(point.label)!, value: point.value as number } : undefined);
    if (points.length === 0 || points.some((point) => !point)) errors.push("data 的每一项需要 label（文本）和 value（数字）。");
    else { labels = points.map((point) => point!.label); series = [{ name: title ?? "数值", data: points.map((point) => point!.value) }]; }
  } else {
    const rawLabels = Array.isArray(value.labels) ? value.labels.map(label) : undefined;
    if (!rawLabels || rawLabels.length === 0 || rawLabels.some((item) => !item)) errors.push("labels 需要是非空的文本数组。");
    else labels = rawLabels as string[];
    const rawSeries = Array.isArray(value.series) ? value.series : undefined;
    if (!rawSeries || rawSeries.length === 0) errors.push("series 需要是非空数组。");
    else rawSeries.forEach((entry, index) => {
      const name = isObject(entry) ? label(entry.name) : undefined;
      const data = isObject(entry) && Array.isArray(entry.data) ? entry.data : undefined;
      if (!name) errors.push(`series[${index}].name 必填。`);
      if (!data || !data.every(finite)) errors.push(`series[${index}].data 需要是数字数组。`);
      else if (labels.length && data.length !== labels.length) errors.push(`series[${index}].data 有 ${data.length} 个值，labels 有 ${labels.length} 个。`);
      if (name && data?.every(finite)) series.push({ name, data: data as number[] });
    });
  }
  if (labels.length > CHART_LIMITS.labels) errors.push(`最多 ${CHART_LIMITS.labels} 个分类。`);
  if (series.length > CHART_LIMITS.series) errors.push(`最多 ${CHART_LIMITS.series} 组数据。`);
  if (type === "pie") {
    if (series.length > 1) errors.push("饼图只能有一组数据。");
    if (labels.length > CHART_LIMITS.pieSlices) errors.push(`饼图最多 ${CHART_LIMITS.pieSlices} 块。`);
    if (series[0]?.data.some((item) => item < 0)) errors.push("饼图的数值不能为负。");
    else if (series[0] && series[0].data.reduce((sum, item) => sum + item, 0) <= 0) errors.push("饼图的数值总和必须大于 0。");
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, chart: { type: type!, ...(title ? { title } : {}), ...(unit ? { unit } : {}), labels, series } };
}

/** About five round tick values from 0 (or the minimum, when negative) up past the maximum. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const low = Math.min(0, min);
  const high = max <= low ? low + 1 : max;
  const raw = (high - low) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= raw)!;
  const start = Math.floor(low / step) * step;
  const ticks: number[] = [];
  for (let tick = start; tick < high + step / 2; tick += step) ticks.push(Number(tick.toFixed(10)));
  if (ticks[ticks.length - 1] < high) ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(10)));
  return ticks;
}

/** A compact number for axis labels: 1200 → 1.2k, 3500000 → 3.5M. */
export function formatValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${Number((value / 1e9).toFixed(1))}B`;
  if (abs >= 1e6) return `${Number((value / 1e6).toFixed(1))}M`;
  if (abs >= 1e4) return `${Number((value / 1e3).toFixed(1))}k`;
  return String(Number(value.toFixed(2)));
}
