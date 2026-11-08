import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { TemplateCopyProvider } from "@/components/foundations/template-copy/template-copy";
import { ApplicationLanguageStore, applicationLanguageKey, type ApplicationLanguage } from "@/app/application-language-store";
import { translateApplicationCopy } from "./application-language-copy";

interface ApplicationLanguageState {
  language: ApplicationLanguage;
  setLanguage: (language: ApplicationLanguage) => string | null;
}

const LanguageContext = createContext<ApplicationLanguageState>({
  language: "zh-CN", setLanguage: () => "界面语言设置尚未加载。",
});

let store: ApplicationLanguageStore | undefined;
let subscribers = 0;

function languageStore() {
  return store ??= new ApplicationLanguageStore({
    getItem: (key) => globalThis.localStorage.getItem(key),
    setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  });
}

function synchronizeLanguage(event: StorageEvent) {
  if (event.key !== applicationLanguageKey && event.key !== null) return;
  languageStore().reload(event.key === null ? null : event.newValue);
}

function subscribeLanguage(listener: () => void) {
  const unsubscribe = languageStore().subscribe(listener);
  if (subscribers++ === 0 && typeof window !== "undefined") window.addEventListener("storage", synchronizeLanguage);
  return () => {
    unsubscribe();
    if (--subscribers === 0 && typeof window !== "undefined") window.removeEventListener("storage", synchronizeLanguage);
  };
}

function currentLanguage(): ApplicationLanguage { return languageStore().language; }

export function ApplicationLanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribeLanguage, currentLanguage, (): ApplicationLanguage => "zh-CN");
  const translate = useCallback((text: string) => translateApplicationCopy(text, language), [language]);
  const setLanguage = useCallback((next: ApplicationLanguage) => languageStore().setLanguage(next), []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const state = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={state}>
    <TemplateCopyProvider translate={translate}>{children}</TemplateCopyProvider>
  </LanguageContext.Provider>;
}

export function useApplicationLanguage() {
  return useContext(LanguageContext);
}
