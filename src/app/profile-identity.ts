import type { DesktopAccountProfile } from "./desktop-account-contract";
import type { LocalProfile } from "./local-profile";

/** The account fields the profile header shows once a NekoPapa account is signed in. */
export type ProfileAccount = Pick<DesktopAccountProfile, "userName" | "avatarUrl" | "nekoId" | "cloudPlanCode">;

export interface ProfileIdentity {
  name: string;
  initials: string;
  /** `@NekoID` from the signed-in account; absent for the local profile. */
  handle?: string;
  avatarUrl?: string;
  /** Plan code exactly as the account service reports it. */
  plan?: string;
  source: "local" | "account";
}

export function profileInitials(name: string) {
  return Array.from(name.trim()).slice(0, 2).join("").toUpperCase();
}

/**
 * One identity for the header and account menu. A signed-in account supplies
 * the name, avatar, NekoID and plan; without one the local profile is shown.
 * The local name stays the fallback when the account has no user name.
 */
export function profileIdentity(local: LocalProfile, account?: ProfileAccount): ProfileIdentity {
  const name = account?.userName?.trim() || local.name.trim() || "NekoPapa 用户";
  if (!account) return { name, initials: profileInitials(name), source: "local" };
  return {
    name,
    initials: profileInitials(name),
    handle: account.nekoId ? `@${account.nekoId}` : undefined,
    avatarUrl: account.avatarUrl,
    plan: account.cloudPlanCode,
    source: "account",
  };
}
