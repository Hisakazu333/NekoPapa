// Product presentation contract. A future service adapter supplies the actual quota;
// wallet balances and lifetime grants cannot stand in for a period's allocation.
export interface CloudQuotaSnapshot {
  total: number;
  used: number;
  remaining: number;
  periodLabel?: string;
  resetsAt?: string;
}
export function cloudQuotaPercentage(quota?: CloudQuotaSnapshot): number | undefined {
  if (!quota || ![quota.total, quota.used, quota.remaining].every(Number.isFinite)
    || quota.total <= 0 || quota.used < 0 || quota.remaining < 0
    || quota.used + quota.remaining > quota.total + 0.00001) return;
  return Math.min(100, quota.remaining / quota.total * 100);
}

export function cloudPointCount(value?: number): string {
  return value === undefined || !Number.isFinite(value) || value < 0 ? "—"
    : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 5 }).format(value);
}

export function quotaPercentage(value?: number): string {
  return value === undefined || !Number.isFinite(value) || value < 0 || value > 100 ? "—"
    : `${Number(value.toFixed(1))}%`;
}

export function quotaResetTime(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date)
    : "—";
}
