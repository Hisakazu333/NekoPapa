import type { CloudQuotaSnapshot } from "./cloud-account-contract";

export type ConfigurationGroup = "profile" | "appearance" | "voice" | "agent" | "personalization" | "desktop" | "computer" | "history" | "screenshots" | "browser" | "coding" | "review" | "git" | "worktrees";
export type ConfigurationValue = string | boolean | number;
export type ConfigurationValues = Record<string, ConfigurationValue>;
export type ConfigurationCollection = "models" | "extensions" | "connections" | "hooks";
export interface ConfigurationField {
  key: string;
  label: string;
  hint: string;
  type: "text" | "textarea" | "select" | "boolean" | "number";
  initial: ConfigurationValue;
  options?: readonly (readonly [string, string])[];
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  required?: boolean;
  format?: "url" | "environment" | "branch" | "host";
}
export interface ConfigurationBlock { title: string; fields: readonly ConfigurationField[] }
export interface ConfigurationSchema {
  id: ConfigurationGroup;
  effect: "immediate" | "runtime";
  scope: string;
  blocks: readonly ConfigurationBlock[];
}
export interface ConfigurationRecord { id: string; values: ConfigurationValues }
export interface ConfigurationData {
  version: 1;
  groups: Record<ConfigurationGroup, ConfigurationValues>;
  collections: Record<ConfigurationCollection, ConfigurationRecord[]>;
}
export interface ConfigurationDraft { values: ConfigurationValues; base: ConfigurationValues; errors: Record<string, string> }
export interface ConfigurationView {
  data: ConfigurationData;
  drafts: Partial<Record<ConfigurationGroup, ConfigurationDraft>>;
  storageAvailable: boolean;
  notice: string;
  importPreview?: ConfigurationData;
  importError?: string;
  queries: Partial<Record<ConfigurationCollection | "shortcuts", string>>;
  removedRecord?: { collection: ConfigurationCollection; name: string };
  cloudQuota?: CloudQuotaSnapshot;
}
export interface ConfigurationStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export const configurationKey = "nekopapa.settings.v1";
export const configurationCollections: ConfigurationCollection[] = ["models", "extensions", "connections", "hooks"];
