export function rankSearchEntries<T extends { title: string; subtitle: string; group: boolean }>(entries: T[], query: string, limit = 20): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  const count = Math.max(0, Math.floor(limit));
  if (!normalized) return entries.slice(0, count);

  const rank = (entry: T): number => {
    const title = entry.title.toLocaleLowerCase();
    return title === normalized ? 0 : title.includes(normalized) ? 1 : 2;
  };

  return entries
    .filter((entry) => `${entry.title} ${entry.subtitle}`.toLocaleLowerCase().includes(normalized))
    .sort((a, b) => rank(a) - rank(b) || Number(b.group) - Number(a.group))
    .slice(0, count);
}
