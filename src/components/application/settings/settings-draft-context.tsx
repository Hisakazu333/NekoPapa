import { createContext, useCallback, useContext, useEffect } from "react";
export type ReportSettingsDraft = (section: string, dirty: boolean) => void;

const SettingsDraftContext = createContext<ReportSettingsDraft>(() => {});

export const SettingsDraftProvider = SettingsDraftContext.Provider;

export function useSettingsDraft(section: string, dirty: boolean): () => void {
  const report = useContext(SettingsDraftContext);
  useEffect(() => {
    report(section, dirty);
    return () => report(section, false);
  }, [dirty, report, section]);
  return useCallback(() => report(section, false), [report, section]);
}
