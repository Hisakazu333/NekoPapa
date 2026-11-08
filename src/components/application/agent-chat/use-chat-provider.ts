import { useEffect, useState } from "react";
import { parseChatProviderProbe, type ChatProviderProbe } from "@/app/chat-provider-status";

export function useChatProvider(endpoint: string) {
  const [probe, setProbe] = useState<ChatProviderProbe>(() => ({ ...parseChatProviderProbe(null), status: "checking" }));
  // Ask the runtime what it has before the first message, so a deployment with
  // no key renders setup steps instead of letting someone type into a dead box.
  useEffect(() => {
    let cancelled = false;
    fetch(endpoint, { method: "GET" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        // Only an explicit `configured: false` means "no key". A failed or
        // unreadable probe says nothing about the key, and treating it as
        // missing would hide the composer behind setup steps for a fault that
        // has nothing to do with configuration.
        setProbe(parseChatProviderProbe(data));
      })
      .catch(() => {
        // A failed probe shouldn't lock the composer — let the send attempt
        // surface the real error rather than guessing the cause here.
        if (!cancelled) setProbe(parseChatProviderProbe(null));
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return probe;
}
