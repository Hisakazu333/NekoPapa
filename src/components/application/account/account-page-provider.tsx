import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import {
  captureAccountPageFocusTarget,
  createAccountPageNavigation,
  restoreAccountPageFocusTarget,
  type AccountPage,
  type AccountPageNavigation,
} from "@/app/account/account-page-navigation";
import { AccountSessionProvider } from "./account-session";
import { AccountLoginPage } from "./account-login-page";
import { AccountProfilePage } from "./account-profile-page";

interface AccountPageActions {
  open: (page: AccountPage, returnFocusTarget?: HTMLElement | null, fallback?: HTMLElement | null) => void;
  openAvatar: (returnFocusTarget?: HTMLElement | null) => void;
  close: () => void;
}

const AccountPageContext = createContext<AccountPageActions | null>(null);

function browserNavigation(): AccountPageNavigation {
  return createAccountPageNavigation({
    getHash: () => window.location.hash,
    getState: () => window.history.state,
    push: (state, hash) => window.history.pushState(state, "", hash),
    replace: (state, hash) => window.history.replaceState(state, "", `${window.location.pathname}${window.location.search}${hash}`),
    back: () => window.history.back(),
    subscribe(listener) {
      window.addEventListener("popstate", listener);
      window.addEventListener("hashchange", listener);
      return () => {
        window.removeEventListener("popstate", listener);
        window.removeEventListener("hashchange", listener);
      };
    },
  });
}

export function AccountPageProvider({ children }: { children: ReactNode }) {
  const navigationRef = useRef<AccountPageNavigation | null>(null);
  if (!navigationRef.current) navigationRef.current = browserNavigation();
  const navigation = navigationRef.current;
  const page = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot, () => null);
  const returnFocus = useRef<{ target: HTMLElement | null; fallback?: HTMLElement | null } | null>(null);
  const editAvatar = useRef(false);

  const open = useCallback((next: AccountPage, returnFocusTarget?: HTMLElement | null, fallback?: HTMLElement | null) => {
    if (!navigation.getSnapshot()) {
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      returnFocus.current = { target: captureAccountPageFocusTarget(returnFocusTarget, activeElement), fallback };
    }
    navigation.open(next);
  }, [navigation]);
  const openAvatar = useCallback((target?: HTMLElement | null) => {
    editAvatar.current = true;
    open("profile", target);
  }, [open]);
  const close = useCallback(() => navigation.close(), [navigation]);
  const actions = useMemo(() => ({ open, openAvatar, close }), [close, open, openAvatar]);

  useEffect(() => {
    // The profile editor consumes the intent on mount. Browser Forward opens
    // the normal overview again.
    if (page === "profile") editAvatar.current = false;
    if (page || !returnFocus.current) return;
    const { target, fallback } = returnFocus.current;
    returnFocus.current = null;
    restoreAccountPageFocusTarget(target?.isConnected ? target : fallback ?? null,
      (callback) => window.requestAnimationFrame(callback));
  }, [page]);

  return (
    <AccountSessionProvider><AccountPageContext.Provider value={actions}>
      <div aria-hidden={Boolean(page) || undefined} inert={Boolean(page) || undefined} className="h-full min-h-0">
        {children}
      </div>
      {page === "login" && <AccountLoginPage onBack={close} fromProfile={navigation.returnsToProfile()} />}
      {page === "profile" && <AccountProfilePage onBack={close} onLogin={() => open("login")} editAvatar={editAvatar.current} />}
    </AccountPageContext.Provider></AccountSessionProvider>
  );
}

export function useAccountPageNavigation(): AccountPageActions {
  const actions = useContext(AccountPageContext);
  if (!actions) throw new Error("AccountPageProvider is missing");
  return actions;
}
