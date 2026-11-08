import { readLocalProfile, saveLocalProfile, type LocalProfile } from "@/app/local-profile";
import { useConfiguration } from "@/hooks/use-configuration";

export function useLocalProfile() {
  const { store, storageAvailable, notice, refresh } = useConfiguration();
  const saveProfile = (profile: LocalProfile, original: LocalProfile) => {
    const errors = saveLocalProfile(store, profile, original);
    refresh();
    return errors;
  };
  return { profile: readLocalProfile(store), storageAvailable, notice, saveProfile };
}
