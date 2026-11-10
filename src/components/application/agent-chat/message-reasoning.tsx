import { useEffect, useState } from "react";
import { BrainIcon, ChevronRightIcon } from "@/components/foundations/icons/app-icons";
import { cx } from "@/utils/cx";

/**
 * The model's reasoning, when the provider streams it (DeepSeek R1, Qwen
 * thinking models, Claude with extended thinking). Open while it is being
 * written, then folded to one line; nothing shows for models that send none.
 */
export function MessageReasoning({ text, streaming }: { text: string; streaming: boolean }) {
  const [open, setOpen] = useState(streaming);
  const [started] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!streaming) { setOpen(false); return; }
    setOpen(true);
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [streaming, started]);
  if (!text.trim()) return null;
  const label = streaming ? `正在思考${seconds ? ` · ${seconds} 秒` : "…"}` : seconds ? `思考了 ${seconds} 秒` : "思考过程";

  return <div className="flex flex-col gap-1.5">
    <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}
      className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-caption-1-medium text-text-tertiary outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
      <BrainIcon className={cx("size-3.5", streaming && "animate-pulse")} aria-hidden />
      {label}
      <ChevronRightIcon className={cx("size-3.5 transition-transform", open && "rotate-90")} aria-hidden />
    </button>
    {open && <p translate="no" className="ms-2.5 max-h-72 overflow-y-auto border-s border-separator-border ps-3 text-body-2-regular whitespace-pre-wrap text-text-tertiary">{text}</p>}
  </div>;
}
