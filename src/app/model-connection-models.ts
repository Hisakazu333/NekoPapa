import type { ConfigurationValues } from "./configuration-types";

export const MODEL_ID_LIMIT = 160;
export const MODELS_PER_CONNECTION = 100;

export function validModelId(id: string): boolean {
  return id.length > 0 && id.length <= MODEL_ID_LIMIT && !/[\u0000-\u001f\u007f]/.test(id);
}

/** The first model retains the connection's original ID and default settings. */
export function connectionModelIds(values: ConfigurationValues): string[] {
  const primary = String(values.model ?? "").trim();
  const extra = String(values.additionalModels ?? "").split("\n").map((id) => id.trim());
  return [...new Set([primary, ...extra].filter(validModelId))].slice(0, MODELS_PER_CONNECTION);
}
