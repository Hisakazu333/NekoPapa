import { CpuIcon } from "@/components/foundations/icons/app-icons";
import { CHAT_UNCONFIGURED_REASON } from "@/app/chat/chat-provider-status";
import { Button } from "@/components/base/buttons/button";

/**
 * What the home page shows while it cannot send. A missing model gets one
 * clear card with the way to fix it; any other reason (still checking, an
 * official companion offline) stays a single status line.
 */
export function HomeSendStatus({ id, reason, official, canConfigure, onConfigure, onLeaveContact }: {
  id: string;
  reason?: string;
  official: boolean;
  canConfigure: boolean;
  onConfigure: () => void;
  onLeaveContact: () => void;
}) {
  if (!official && canConfigure && (!reason || reason === CHAT_UNCONFIGURED_REASON)) {
    return <div id={id} role="status" className="mx-auto mt-6 flex w-full max-w-[560px] items-center gap-3 rounded-2xl border border-separator-border bg-background-primary-default p-3 ps-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background-secondary-default text-foreground-icon-secondary">
        <CpuIcon className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-2-medium text-text-primary">先连接一个模型</span>
        <span className="text-caption-1-regular text-text-tertiary">添加 API 密钥或本机模型后即可对话，可以先写下想法。</span>
      </span>
      <Button size="small" variant="secondary" className="shrink-0" onClick={onConfigure}>配置模型</Button>
    </div>;
  }
  return <p id={id} role="status" className="mt-4 flex flex-wrap items-center justify-center gap-2 text-center text-caption-1-regular text-text-tertiary">
    {reason ?? "连接模型后即可发送，你可以先写下想法。"}
    {official && <button type="button" onClick={onLeaveContact}
      className="cursor-pointer text-text-secondary underline underline-offset-2">返回工作台对话</button>}
  </p>;
}
