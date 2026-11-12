import { useEffect, useState } from "react";
import { dataFolderAvailable, searchChatMessages } from "@/platform/app-data-bridge";
import type { ChatTextHit } from "./sidebar-search";

const NONE: ChatTextHit[] = [];

/**
 * Desktop quick search over the full text of every chat (the local
 * database's index), a moment after typing stops. In the browser, or when
 * the search fails, there are no extra hits and the in-memory search stands
 * alone. A late answer for an older query is dropped.
 */
export function useChatTextSearch(query: string): ChatTextHit[] {
  const [hits, setHits] = useState<{ query: string; hits: ChatTextHit[] }>({ query: "", hits: NONE });
  const trimmed = query.trim();
  useEffect(() => {
    if (!trimmed || !dataFolderAvailable()) return;
    let live = true;
    const timer = window.setTimeout(() => {
      void searchChatMessages(trimmed).then(
        (found) => { if (live) setHits({ query: trimmed, hits: found.map(({ threadId, snippet }) => ({ threadId, snippet })) }); },
        () => { if (live) setHits({ query: trimmed, hits: NONE }); },
      );
    }, 150);
    return () => { live = false; window.clearTimeout(timer); };
  }, [trimmed]);
  return trimmed && hits.query === trimmed ? hits.hits : NONE;
}
