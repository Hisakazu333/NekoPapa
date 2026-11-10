import { useSyncExternalStore } from "react";
import { ConfigurationStore } from "@/app/settings/configuration-store";
import { configurationKey, type ConfigurationData } from "@/app/settings/configuration-types";

interface ConfigurationSnapshot {
  data: ConfigurationData;
  storageAvailable: boolean;
  notice: string;
}

let instance: ConfigurationStore | undefined;
let snapshot: ConfigurationSnapshot | undefined;
const listeners = new Set<() => void>();

export function configurationStore() {
  return instance ??= new ConfigurationStore({
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  });
}

function getSnapshot(): ConfigurationSnapshot {
  if (!snapshot) {
    const store = configurationStore();
    snapshot = { data: store.data, storageAvailable: store.storageAvailable, notice: store.notice };
  }
  return snapshot;
}

export function publishConfiguration() {
  snapshot = undefined;
  getSnapshot();
  for (const listener of listeners) listener();
}

function synchronize(event: StorageEvent) {
  if (event.key !== configurationKey && event.key !== null) return;
  configurationStore().reload(event.key === null ? null : event.newValue);
  publishConfiguration();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", synchronize);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", synchronize);
  };
}

export function useConfiguration() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...current, store: configurationStore(), refresh: publishConfiguration };
}
