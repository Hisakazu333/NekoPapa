import { useEffect, useState } from "react";

/** The 60-second wait before another SMS code can be requested. */
export function useCodeCountdown(seconds = 60) {
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const remaining = Math.max(0, Math.ceil((sentAt + seconds * 1000 - now) / 1000));

  useEffect(() => {
    if (!sentAt) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= sentAt + seconds * 1000) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sentAt, seconds]);

  return {
    remaining,
    start() {
      const current = Date.now();
      setNow(current);
      setSentAt(current);
    },
  };
}
