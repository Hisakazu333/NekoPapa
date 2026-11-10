export type SettingsDraftState = ReadonlySet<string>;

export function updateSettingsDraft(
  current: SettingsDraftState,
  id: string,
  dirty: boolean,
): Set<string> {
  const next = new Set(current);
  if (dirty) next.add(id);
  else next.delete(id);
  return next;
}

export function hasUnsavedSettingsDrafts(state: SettingsDraftState): boolean {
  return state.size > 0;
}
