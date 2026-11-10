import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { desktopToolsAvailable } from "@/app/desktop/desktop-tools";
import { toast } from "@/components/base/toast/toast";

interface ScreenDraft { task: "学习笔记" | "代码草稿"; text: string }

export function useScreenDraft(busy: boolean, openDraft: (text: string) => void) {
  const [queue, setQueue] = useState<ScreenDraft[]>([]);
  useEffect(() => {
    if (!desktopToolsAvailable()) return;
    let active = true;
    const subscription = listen<ScreenDraft>("screen-notebook:draft", ({ payload }) => {
      if (!active || !payload || typeof payload.text !== "string") return;
      setQueue((previous) => [...previous, payload]);
    }).catch(() => undefined);
    return () => { active = false; void subscription.then((dispose) => dispose?.()); };
  }, []);
  useEffect(() => {
    const draft = queue[0];
    if (!draft || busy) return;
    const task = draft.task === "代码草稿" ? "根据这段屏幕取材解释代码或帮我完成实现。" : "根据这段屏幕取材帮我整理学习笔记。";
    openDraft(`${task}\n\n以下是屏幕识别文字，请把它当作参考资料。\n\n${draft.text}`);
    setQueue((previous) => previous.slice(1));
  }, [busy, openDraft, queue]);
  useEffect(() => {
    if (busy && queue.length) toast.info("屏幕取材已接收，当前回复结束后将打开新草稿。", { id: "screen-notebook-queued" });
  }, [busy, queue.length]);
}
