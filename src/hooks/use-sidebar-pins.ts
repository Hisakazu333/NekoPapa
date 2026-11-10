import { useCallback, useState } from "react";
import { readSidebarPins, saveSidebarPins, toggleSidebarPin, type SidebarDestination } from "@/app/navigation/sidebar-pins";

const browserStorage = {
  getItem: (key: string) => globalThis.localStorage.getItem(key),
  setItem: (key: string, value: string) => globalThis.localStorage.setItem(key, value),
};

/** Sidebar pins with a visible notice when the device refuses to save them. */
export function useSidebarPins() {
  const [pins, setPins] = useState(() => readSidebarPins(browserStorage));
  const [notice, setNotice] = useState("");
  const toggle = useCallback((id: SidebarDestination) => {
    setPins((current) => {
      const next = toggleSidebarPin(current, id);
      setNotice(saveSidebarPins(browserStorage, next) ? "" : "固定状态未能保存到本机，重启后会恢复原样。");
      return next;
    });
  }, []);
  return { pins, toggle, notice };
}
