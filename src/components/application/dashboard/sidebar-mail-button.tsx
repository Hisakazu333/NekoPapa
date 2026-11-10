import { Button as AriaButton } from "react-aria-components";
import { MailIcon } from "@/components/foundations/icons/app-icons";
import { Popover, PopoverHeader, PopoverTrigger } from "@/components/base/popover/popover";
import { cx } from "@/utils/cx";

/**
 * 邮件, beside the sidebar's collapse button. No mail service is connected
 * and no mailbox can be added yet, so the panel says exactly that instead of
 * showing an inbox, unread counts or sample messages.
 */
export function SidebarMailButton({ className }: { className?: string }) {
  return <PopoverTrigger>
    <AriaButton aria-label="邮件" className={cx(
      "flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none",
      "transition-colors duration-150 hover:bg-background-secondary-hover hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring",
      className,
    )}>
      <MailIcon className="size-5" aria-hidden />
    </AriaButton>
    <Popover aria-label="邮件" placement="bottom start" className="w-[280px]">
      <PopoverHeader title="邮件" description="邮件服务尚未接入，暂时不能添加邮箱或收发邮件。" />
      <p className="rounded-xl bg-background-secondary-default px-3 py-3 text-body-2-regular text-text-secondary">
        接入后，这里会显示收件箱，并可把邮件交给对话处理。
      </p>
    </Popover>
  </PopoverTrigger>;
}
