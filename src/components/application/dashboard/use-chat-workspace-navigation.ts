import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { WorkspacePage } from "./workspace-page";

export function useChatWorkspaceNavigation({
  setNavOpen,
  setPage,
  setPanelOpen,
}: {
  setNavOpen: Dispatch<SetStateAction<boolean>>;
  setPage: Dispatch<SetStateAction<WorkspacePage>>;
  setPanelOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const showAllThreads = useCallback(() => {
    setPage("chat");
    setPanelOpen(true);
    setNavOpen(false);
  }, [setNavOpen, setPage, setPanelOpen]);

  return { showAllThreads };
}
