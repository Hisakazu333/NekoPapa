/** Persisted JSON objects have no property order; message arrays retain their order. */
export function sameJsonData(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  const canonical = (value: unknown) => JSON.stringify(value, (_key, entry: unknown) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return entry;
    const record = entry as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
  });
  return canonical(left) === canonical(right);
}
