import { createContext, useContext } from "react";

/**
 * The element that opened settings. A page that leaves settings for another
 * application page (the account login page) hands it on, so focus returns to
 * the workspace control rather than to a closed dialog.
 */
export const SettingsOpenerContext = createContext<() => HTMLElement | null>(() => null);

export function useSettingsOpener() {
  return useContext(SettingsOpenerContext);
}
