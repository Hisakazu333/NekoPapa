import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { SettingsModal } from "./settings-modal";
import type { SettingsSection } from "./workspace-settings-catalog";

export type OpenWorkspaceSettings = (section: SettingsSection, returnFocusTarget?: HTMLElement | null) => void;

const SettingsContext = createContext<OpenWorkspaceSettings>(() => {});

export function useWorkspaceSettings() {
  return useContext(SettingsContext);
}

export function WorkspaceSettingsProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ open: boolean; page: SettingsSection; id: number }>({ open: false, page: "general", id: 0 });
  const returnFocus = useRef<HTMLElement | null>(null);
  const sessionOpen = useRef(session.open);
  sessionOpen.current = session.open;
  const rememberFocus = useCallback((target?: HTMLElement | null) => {
    const element = target ?? document.activeElement;
    if (element instanceof HTMLElement && !element.closest('[role="dialog"]')) returnFocus.current = element;
  }, []);
  const restoreFocus = useCallback(() => {
    if (!sessionOpen.current && returnFocus.current?.isConnected) returnFocus.current.focus();
  }, []);
  const open = useCallback<OpenWorkspaceSettings>((page, returnFocusTarget) => {
    rememberFocus(returnFocusTarget);
    setSession((current) => ({ open: true, page, id: current.open ? current.id : current.id + 1 }));
  }, [rememberFocus]);
  const close = useCallback(() => setSession((current) => ({ ...current, open: false })), []);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!event.repeat && (event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        if (!session.open) rememberFocus();
        setSession((current) => current.open
          ? { ...current, open: false }
          : { open: true, page: "general", id: current.id + 1 });
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [rememberFocus, session.open]);

  return (
    <SettingsContext.Provider value={open}>
      {children}
      <SettingsModal key={session.id} isOpen={session.open} onClose={close} onAfterClose={restoreFocus} defaultPage={session.page} />
    </SettingsContext.Provider>
  );
}
