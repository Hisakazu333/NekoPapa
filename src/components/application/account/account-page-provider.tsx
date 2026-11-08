import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import {
  captureAccountPageFocusTarget,
  createAccountPageNavigation,
  restoreAccountPageFocusTarget,
  type AccountPageNavigation,
} from "@/app/account-page-navigation";
import { AccountLoginPage } from "./account-login-page";

interface AccountPageActions {
  open: (returnFocusTarget?: HTMLElement | null) => void;
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
  const loginOpen = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot, () => false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(loginOpen);

  const open = useCallback((returnFocusTarget?: HTMLElement | null) => {
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    returnFocus.current = captureAccountPageFocusTarget(returnFocusTarget, activeElement);
    navigation.open();
  }, [navigation]);
  const close = useCallback(() => navigation.close(), [navigation]);
  const actions = useMemo(() => ({ open, close }), [close, open]);

  useEffect(() => {
    if (loginOpen) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const target = returnFocus.current;
    returnFocus.current = null;
    restoreAccountPageFocusTarget(target, (callback) => window.requestAnimationFrame(callback));
  }, [loginOpen]);

  useEffect(() => {
    if (!loginOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    document.addEventListener("keydown", dismiss, true);
    return () => document.removeEventListener("keydown", dismiss, true);
  }, [close, loginOpen]);

  return (
    <AccountPageContext.Provider value={actions}>
      <div aria-hidden={loginOpen || undefined} inert={loginOpen || undefined} className="h-full min-h-0">
        {children}
      </div>
      {loginOpen && <AccountLoginPage onBack={close} />}
    </AccountPageContext.Provider>
  );
}

export function useAccountPageNavigation(): AccountPageActions {
  const actions = useContext(AccountPageContext);
  if (!actions) throw new Error("AccountPageProvider is missing");
  return actions;
}
