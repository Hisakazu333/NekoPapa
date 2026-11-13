import { HistoryIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { Button } from "@/components/base/buttons/button";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { canSteerMessage } from "@/app/agent/message-queue";
import type { MessageQueue } from "./use-message-queue";

/**
 * Messages waiting above the composer while the Agent works: each with 插话
 * (join the running Agent at its next step, desktop project chats only) and
 * a remove button. After the user stopped the run they wait for 发送.
 */
export function ComposerQueue({ queue }: { queue: MessageQueue }) {
  if (queue.items.length === 0) return null;
  const hint = queue.stopped ? "已停止，排队的消息没有发送" : "当前任务结束后发送";
  return <section aria-label="排队的消息" className="mx-4 mb-1.5 flex flex-col gap-1 rounded-2xl border border-separator-border bg-background-primary-default px-2.5 py-2 sm:mx-7">
    <header className="flex items-center gap-1.5 px-0.5 text-caption-1-medium text-text-tertiary">
      <HistoryIcon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{queue.items.length} 条排队 · {hint}</span>
      {queue.stopped && <Button variant="secondary" size="xs" onClick={queue.sendNow}>发送</Button>}
    </header>
    <ul className="flex flex-col gap-0.5">
      {queue.items.map((item) => <li key={item.id} className="flex min-h-7 items-center gap-2 rounded-lg px-0.5">
        <div className="min-w-0 flex-1">
          <p title={item.text} className="truncate text-body-2-regular text-text-primary">{item.text}</p>
          {item.note && <p className="truncate text-caption-1-regular text-text-tertiary">{item.note}</p>}
        </div>
        {item.state === "steering"
          ? <span className="flex shrink-0 items-center gap-1 text-caption-1-regular text-text-tertiary"><SpinnerGlyph size="xs" className="size-3" />下一步加入</span>
          : queue.canSteer && canSteerMessage(item) && <Button variant="ghost" size="xs" title="在 Agent 的下一步之前把这条消息交给它" onClick={() => void queue.steer(item.id)}>插话</Button>}
        <Button variant="ghost" size="xs" iconOnly leadingIcon={XIcon} aria-label={`移除排队消息：${item.text}`} disabled={item.state === "steering"} onClick={() => queue.remove(item.id)} />
      </li>)}
    </ul>
  </section>;
}
