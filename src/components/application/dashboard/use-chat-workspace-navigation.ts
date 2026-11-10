import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { WorkspacePage } from "./workspace-page";

export function useChatWorkspaceNavigation({
  setNavOpen,
  setPage,
  openSidePanel,
}: {
  setNavOpen: (open: boolean) => void;
  setPage: Dispatch<SetStateAction<WorkspacePage>>;
  /** Opens the 历史 / 代码 / 资料 side panel (in place of the browser, if open). */
  openSidePanel: () => void;
}) {
  const showAllThreads = useCallback(() => {
    setPage("chat");
    openSidePanel();
    setNavOpen(false);
  }, [setNavOpen, setPage, openSidePanel]);

  return { showAllThreads };
}
