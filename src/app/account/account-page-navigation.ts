export const ACCOUNT_PAGE_HISTORY_KEY = "__nekopapa_account_page_navigation_v1";
const ACCOUNT_PAGE_NAMESPACE = "nekopapa.account-page-navigation";
const ACCOUNT_PAGE_VERSION = 1;
const pageHashes = { login: "#login", profile: "#profile" } as const;
export type AccountPage = keyof typeof pageHashes;

export interface AccountPageNavigationPort {
  getHash: () => string;
  getState: () => unknown;
  push: (state: unknown, hash: string) => void;
  replace: (state: unknown, hash: string) => void;
  back: () => void;
  subscribe: (listener: () => void) => () => void;
}

export interface AccountPageNavigation {
  getSnapshot: () => AccountPage | null;
  returnsToProfile: () => boolean;
  subscribe: (listener: () => void) => () => void;
  open: (page: AccountPage) => void;
  close: () => void;
}

export interface AccountPageFocusTarget {
  isConnected: boolean;
  focus: () => void;
}

export function captureAccountPageFocusTarget<T extends AccountPageFocusTarget>(
  requested: T | null | undefined,
  activeElement: T | null,
): T | null {
  return requested === undefined ? activeElement : requested;
}

export function restoreAccountPageFocusTarget(
  target: AccountPageFocusTarget | null,
  schedule: (callback: () => void) => unknown,
): void {
  if (!target?.isConnected) return;
  schedule(() => {
    if (target.isConnected) target.focus();
  });
}

interface AccountPageHistoryMarker {
  namespace: string;
  version: number;
  returnHash: string;
}

function accountPageAt(hash: string): AccountPage | null {
  if (hash === pageHashes.login) return "login";
  if (hash === pageHashes.profile) return "profile";
  return null;
}

function cleanReturnHash(hash: unknown): string {
  return typeof hash === "string" && hash !== pageHashes.login ? hash : "";
}

function stateWithMarker(state: unknown, marker: AccountPageHistoryMarker): Record<string, unknown> {
  const base = state !== null && typeof state === "object" && !Array.isArray(state)
    ? state as Record<string, unknown>
    : state === null || state === undefined ? {} : { __nekopapa_previous_history_state: state };
  return { ...base, [ACCOUNT_PAGE_HISTORY_KEY]: marker };
}

function readMarker(state: unknown): AccountPageHistoryMarker | undefined {
  if (state === null || typeof state !== "object" || Array.isArray(state)) return undefined;
  const marker = (state as Record<string, unknown>)[ACCOUNT_PAGE_HISTORY_KEY];
  if (!marker || typeof marker !== "object" || Array.isArray(marker)) return undefined;
  const value = marker as Partial<AccountPageHistoryMarker>;
  if (value.namespace !== ACCOUNT_PAGE_NAMESPACE || value.version !== ACCOUNT_PAGE_VERSION || typeof value.returnHash !== "string") {
    return undefined;
  }
  return { ...value, returnHash: cleanReturnHash(value.returnHash) } as AccountPageHistoryMarker;
}

/** Keeps account-page navigation separate from the mounted chat workspace. */
export function createAccountPageNavigation(port: AccountPageNavigationPort): AccountPageNavigation {
  const listeners = new Set<() => void>();
  let unsubscribePort: (() => void) | undefined;
  const getSnapshot = () => accountPageAt(port.getHash());
  let lastSnapshot = getSnapshot();
  const emitIfChanged = () => {
    const next = getSnapshot();
    if (next === lastSnapshot) return;
    lastSnapshot = next;
    for (const listener of listeners) listener();
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (!unsubscribePort) {
      lastSnapshot = getSnapshot();
      unsubscribePort = port.subscribe(emitIfChanged);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        unsubscribePort?.();
        unsubscribePort = undefined;
      }
    };
  };

  return {
    getSnapshot,
    returnsToProfile: () => getSnapshot() === "login" && readMarker(port.getState())?.returnHash === pageHashes.profile,
    subscribe,
    open(page) {
      const currentHash = port.getHash();
      const nextHash = pageHashes[page];
      if (currentHash === nextHash) return;
      if (currentHash === pageHashes.login) return;
      const marker: AccountPageHistoryMarker = {
        namespace: ACCOUNT_PAGE_NAMESPACE,
        version: ACCOUNT_PAGE_VERSION,
        returnHash: cleanReturnHash(currentHash),
      };
      port.push(stateWithMarker(port.getState(), marker), nextHash);
      emitIfChanged();
    },
    close() {
      if (!getSnapshot()) return;
      const marker = readMarker(port.getState());
      if (marker) {
        port.back();
        return;
      }
      port.replace(port.getState(), "");
      emitIfChanged();
    },
  };
}
