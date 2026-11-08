import { useCallback, type Dispatch, type SetStateAction } from "react";

type WorkspacePage = "chat" | "contacts";

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
