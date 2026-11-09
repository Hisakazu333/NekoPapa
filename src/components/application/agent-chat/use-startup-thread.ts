import { useEffect, useRef } from "react";
import { useConfiguration } from "@/hooks/use-configuration";
import { orderThreads, type StoredThread } from "./thread-storage";

/**
 * Applies General → 启动时打开 once per launch: with "最近的对话", the most
 * recently updated workbench chat opens after history has loaded; otherwise
 * (or with no chats) the blank draft stays.
 */
export function useStartupThread({ ready, activeId, threads, onOpen }: {
  ready: boolean;
  activeId: string;
  threads: readonly StoredThread[];
  onOpen: (id: string) => void;
}) {
  const { data } = useConfiguration();
  const done = useRef(false);
  const startup = data.groups.general.startup;
  useEffect(() => {
    if (done.current || !ready || !activeId) return;
    done.current = true;
    if (startup !== "last") return;
    const latest = orderThreads(threads.filter((thread) => !thread.contact && thread.messages.length > 0))[0];
    if (latest && latest.id !== activeId) onOpen(latest.id);
  }, [ready, activeId, threads, onOpen, startup]);
}
