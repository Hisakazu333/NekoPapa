import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { parseDesktopAccountProfile, type DesktopAccountProfile } from "@/app/account/desktop-account-contract";

type Availability = "checking" | "browser" | "unconfigured" | "available";

interface AccountSession {
  availability: Availability;
  profile?: DesktopAccountProfile;
  setProfile: (profile: DesktopAccountProfile) => void;
  signOut: () => Promise<void>;
}

const AccountSessionContext = createContext<AccountSession | null>(null);

export function AccountSessionProvider({ children }: { children: ReactNode }) {
  const [availability, setAvailability] = useState<Availability>(() => isTauri() ? "checking" : "browser");
  const [profile, setProfile] = useState<DesktopAccountProfile>();
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    void invoke<{ configured: boolean; profile?: unknown }>("account_snapshot").then(({ configured, profile: raw }) => {
      if (!active) return;
      if (raw) setProfile(parseDesktopAccountProfile(raw));
      setAvailability(configured ? "available" : "unconfigured");
    }).catch(() => { if (active) setAvailability("unconfigured"); });
    return () => { active = false; };
  }, []);
  const signOut = async () => {
    await invoke("account_logout");
    setProfile(undefined);
  };
  return <AccountSessionContext.Provider value={{ availability, profile, setProfile, signOut }}>
    {children}
  </AccountSessionContext.Provider>;
}

export function useAccountSession() {
  const session = useContext(AccountSessionContext);
  if (!session) throw new Error("AccountSessionProvider is missing");
  return session;
}
