/** No character model is bundled; backend-approved models will be cached on demand. */
export const agentAppearanceAssets: Readonly<Record<string, { model: string; version: string }>> = {};

export function agentModelAsset(contact: { id: string; kind: "official" | "custom"; appearanceId?: string }) {
  const appearance = contact.appearanceId ?? (contact.kind === "official" ? contact.id : undefined);
  return appearance ? agentAppearanceAssets[appearance] : undefined;
}
