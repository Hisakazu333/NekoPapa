import { validateFields } from "./configuration-contract";
import type { ConfigurationStore } from "./configuration-store";
import type { ConfigurationGroup, ConfigurationValues } from "./configuration-types";

export interface ConfigurationDraftSaveResult {
  saved: boolean;
  values: ConfigurationValues;
  errors: Record<string, string>;
  conflicts: string[];
}

/** Merge only edited fields, checking their original values before writing. */
export function saveConfigurationDraft(
  store: ConfigurationStore,
  group: ConfigurationGroup,
  draft: ConfigurationValues,
  base: ConfigurationValues,
  overwriteConflicts = false,
): ConfigurationDraftSaveResult {
  const failed = (errors: Record<string, string>, conflicts: string[] = []): ConfigurationDraftSaveResult => ({
    saved: false, values: store.data.groups[group], errors, conflicts,
  });
  // A blocked read must recover the source before merging edits into it.
  if (!store.storageAvailable && !store.persist()) return failed({ form: store.notice });
  const latest = store.data.groups[group];
  const next = { ...latest };
  const errors: Record<string, string> = {};
  const conflicts: string[] = [];
  for (const field of store.fields(group)) {
    const value = draft[field.key];
    if (value === base[field.key]) continue;
    const parsed = validateFields([field], { [field.key]: value }, true);
    if (!parsed.ok) { Object.assign(errors, parsed.errors); continue; }
    const edited = parsed.value[field.key];
    if (edited === base[field.key]) continue;
    if (latest[field.key] !== base[field.key] && latest[field.key] !== edited) conflicts.push(field.key);
    next[field.key] = edited;
  }
  if (Object.keys(errors).length) return failed(errors);
  if (conflicts.length && !overwriteConflicts) return failed({ form: "这些字段已在其他位置更改。请选择载入最新值，或明确保存你的更改。" }, conflicts);
  const result = store.saveGroup(group, next);
  if (result) return failed(result);
  if (!store.storageAvailable) return failed({ form: store.notice });
  return { saved: true, values: store.data.groups[group], errors: {}, conflicts: [] };
}
