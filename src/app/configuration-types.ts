import type { CloudQuotaSnapshot } from "./cloud-account-contract";

export type ConfigurationGroup = "general" | "privacy" | "profile" | "appearance" | "voice" | "agent" | "personalization" | "desktop" | "computer" | "history" | "screenshots" | "browser" | "coding" | "permissions" | "context" | "editor" | "review" | "git" | "worktrees";
export type ConfigurationValue = string | boolean | number;
export type ConfigurationValues = Record<string, ConfigurationValue>;
export type ConfigurationCollection = "models" | "extensions" | "plugins" | "connections" | "hooks";
export type ConfigurationControl = "input" | "textarea" | "select" | "segmented" | "switch" | "number" | "slider" | "directory" | "tags";
export interface ConfigurationField {
  key: string;
  label: string;
  hint: string;
  type: "text" | "textarea" | "select" | "boolean" | "number";
  /** Presentation control. Value validation still follows `type`. */
  control?: ConfigurationControl;
  initial: ConfigurationValue;
  options?: readonly (readonly [string, string])[];
  /** Explanation of the selected option, shown in the row description. */
  optionHints?: Readonly<Record<string, string>>;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  unit?: string;
  /** Empty-state hint inside text and directory inputs. */
  placeholder?: string;
  required?: boolean;
  format?: "url" | "environment" | "branch" | "host" | "accent" | "color";
}
export interface ConfigurationBlock {
  title: string;
  fields: readonly ConfigurationField[];
  /** Set when this block's service is not connected although the rest of the page works. */
  pending?: string;
}
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
export const configurationCollections: ConfigurationCollection[] = ["models", "extensions", "plugins", "connections", "hooks"];
