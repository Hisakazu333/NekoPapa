import type { ConfigurationStore } from "../settings/configuration-store";

export interface LocalProfile {
  name: string;
  biography: string;
  website: string;
}

export function readLocalProfile(configuration: ConfigurationStore): LocalProfile {
  const profile = configuration.data.groups.profile;
  return {
    name: String(profile.name),
    biography: String(profile.biography),
    website: String(profile.website),
  };
}

export function saveLocalProfile(
  configuration: ConfigurationStore,
  draft: LocalProfile,
  original: LocalProfile,
): Record<string, string> | undefined {
  // Recovery may restore fields that were unavailable when editing began.
  if (!configuration.storageAvailable && !configuration.persist()) {
    return { form: configuration.notice };
  }
  const latest = readLocalProfile(configuration);
  // Preserve other-window changes and recovered fields the user did not edit.
  for (const key of ["name", "biography", "website"] as const) {
    if (draft[key] !== original[key]) latest[key] = draft[key];
  }
  const errors = configuration.saveGroup("profile", { ...latest });
  return errors ?? (configuration.storageAvailable ? undefined : { form: configuration.notice });
}
