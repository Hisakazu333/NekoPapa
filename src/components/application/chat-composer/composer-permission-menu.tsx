import { useState } from "react";
import { CheckIcon, ShieldAlertIcon, ShieldCheckIcon } from "@/components/foundations/icons/app-icons";
import { Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { ChevronDownSmall } from "@/components/foundations/icons/chevrons";
import { composerPermissions, type ComposerPermission } from "@/app/chat-composer-draft";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import { cx } from "@/utils/cx";
import { COMPOSER_MENU_TRIGGER } from "./composer-trigger-styles";

export function ComposerPermissionMenu({ state, disabled, className }: {
  state: ChatComposerState;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const permission = composerPermissions.find((entry) => entry.id === state.draft.permission) ?? composerPermissions[0];
  // 自动 acts without asking first, so it reads as a warning wherever it shows.
  const risky = permission.id === "auto";
  const Icon = risky ? ShieldAlertIcon : ShieldCheckIcon;

  return <Dropdown isOpen={open} onOpenChange={setOpen}>
    <DropdownTrigger aria-label={`权限控制：${permission.label}`} isDisabled={disabled}
      className={cx(COMPOSER_MENU_TRIGGER, "max-w-40", risky && "bg-background-tertiary-error text-text-error-primary hover:bg-background-quaternary-error aria-expanded:bg-background-quaternary-error", className)}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{permission.label}</span>
      <ChevronDownSmall className={cx("size-4 shrink-0", risky ? "text-text-error-primary" : "text-text-tertiary")} aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label="权限控制" placement="top start" dialogClassName="max-h-[min(420px,70dvh)] overflow-y-auto">
      <DropdownGroup label="权限控制">
        {composerPermissions.map((item) => <DropdownItem key={item.id} selected={permission.id === item.id} onSelect={() => {
          state.setDraft((draft) => ({ ...draft, permission: item.id as ComposerPermission }));
          setOpen(false);
        }} className="items-start gap-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={cx("text-body-medium", item.id === "auto" && "text-text-error-primary")}>{item.label}</span>
            <span className="text-caption-1-regular text-text-tertiary">{item.description}</span>
          </span>
          {permission.id === item.id && <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
        </DropdownItem>)}
      </DropdownGroup>
      <DropdownDivider />
      <p className="px-2 pb-1 text-caption-1-regular text-text-tertiary">这里只保存权限偏好，工具权限执行服务尚未接入。</p>
    </DropdownPopover>
  </Dropdown>;
}
