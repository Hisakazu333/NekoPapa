import type { UsageFlow, UsageNode } from "./usage-stats";

/**
 * Two-column sankey geometry for the usage flow: sources stacked on the left,
 * models on the right, node heights proportional to tokens. Each link is a
 * band whose thickness at either end is its share of that node, ordered by
 * the opposite column so bands cross as little as possible.
 */

export interface PlacedNode extends UsageNode { y: number; height: number; index: number }
export interface PlacedLink { source: string; target: string; tokens: number; sourceIndex: number; y0: number; y1: number; h0: number; h1: number }
export interface SankeyLayout { sources: PlacedNode[]; models: PlacedNode[]; links: PlacedLink[] }

const MIN_NODE = 4;

function stack(nodes: readonly UsageNode[], height: number, gap: number): PlacedNode[] {
  const total = nodes.reduce((sum, node) => sum + node.tokens, 0);
  if (nodes.length === 0 || total <= 0) return [];
  const available = Math.max(0, height - gap * (nodes.length - 1));
  const raw = nodes.map((node) => Math.max(MIN_NODE, (node.tokens / total) * available));
  // Minimum heights can overflow; shrink everything evenly back into the column.
  const scale = Math.min(1, available / raw.reduce((sum, value) => sum + value, 0));
  let y = 0;
  return nodes.map((node, index) => {
    const placed = { ...node, y, height: raw[index] * scale, index };
    y += placed.height + gap;
    return placed;
  });
}

export function sankeyLayout(flow: UsageFlow, { height, gap = 10 }: { height: number; gap?: number }): SankeyLayout {
  const sources = stack(flow.sources, height, gap);
  const models = stack(flow.models, height, gap);
  const sourceOf = new Map(sources.map((node) => [node.key, node]));
  const modelOf = new Map(models.map((node) => [node.key, node]));
  const usable = flow.links.filter((link) => sourceOf.has(link.source) && modelOf.has(link.target) && link.tokens > 0);

  const sourceOffset = new Map<string, number>();
  const targetOffset = new Map<string, number>();
  const placed = new Map<typeof usable[number], PlacedLink>();
  for (const link of [...usable].sort((a, b) => sourceOf.get(a.source)!.index - sourceOf.get(b.source)!.index || modelOf.get(a.target)!.index - modelOf.get(b.target)!.index)) {
    const source = sourceOf.get(link.source)!;
    const h0 = source.tokens > 0 ? (link.tokens / source.tokens) * source.height : 0;
    const y0 = source.y + (sourceOffset.get(source.key) ?? 0);
    sourceOffset.set(source.key, (sourceOffset.get(source.key) ?? 0) + h0);
    placed.set(link, { ...link, sourceIndex: source.index, y0, h0, y1: 0, h1: 0 });
  }
  for (const link of [...usable].sort((a, b) => modelOf.get(a.target)!.index - modelOf.get(b.target)!.index || sourceOf.get(a.source)!.index - sourceOf.get(b.source)!.index)) {
    const target = modelOf.get(link.target)!;
    const entry = placed.get(link)!;
    entry.h1 = target.tokens > 0 ? (link.tokens / target.tokens) * target.height : 0;
    entry.y1 = target.y + (targetOffset.get(target.key) ?? 0);
    targetOffset.set(target.key, (targetOffset.get(target.key) ?? 0) + entry.h1);
  }
  return { sources, models, links: usable.map((link) => placed.get(link)!) };
}

/** Closed band from the left edge (x0) to the right edge (x1), curved at the midpoint. */
export function sankeyBandPath(link: PlacedLink, x0: number, x1: number) {
  const mid = (x0 + x1) / 2;
  const top = `M${x0},${link.y0} C${mid},${link.y0} ${mid},${link.y1} ${x1},${link.y1}`;
  const bottom = `L${x1},${link.y1 + link.h1} C${mid},${link.y1 + link.h1} ${mid},${link.y0 + link.h0} ${x0},${link.y0 + link.h0} Z`;
  return `${top} ${bottom}`;
}
