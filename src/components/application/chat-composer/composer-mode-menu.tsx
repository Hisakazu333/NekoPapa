import { useEffect, useState } from "react";
import { BookOpenIcon, BotIcon, CheckIcon, MessageCircleHeartIcon, UserCogIcon, WandSparklesIcon } from "@/components/foundations/icons/app-icons";
import { Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { ChevronDownSmall } from "@/components/foundations/icons/chevrons";
import { composerModesForContext, selectComposerMode, type ComposerContext, type ComposerMode } from "@/app/chat-composer-draft";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import { cx } from "@/utils/cx";
import { COMPOSER_MENU_TRIGGER } from "./composer-trigger-styles";

const modeIcons = { auto: WandSparklesIcon, chat: MessageCircleHeartIcon, study: BookOpenIcon, professional: UserCogIcon, agent: BotIcon };

export function ComposerModeMenu({ state, context = "custom", disabled, className }: {
  state: ChatComposerState;
  context?: ComposerContext;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const modes = composerModesForContext(context);
  const mode = modes.find((entry) => entry.id === state.draft.mode) ?? modes[0];
  const ModeIcon = modeIcons[mode.id];

  useEffect(() => {
    if (modes.some((entry) => entry.id === state.draft.mode)) return;
    state.setDraft((draft) => ({ ...draft, mode: modes[0].id }));
  }, [modes, state.draft.mode, state.setDraft]);

  return <Dropdown isOpen={open} onOpenChange={setOpen}>
    <DropdownTrigger aria-label={`对话模式：${mode.label}`} isDisabled={disabled}
      className={cx(COMPOSER_MENU_TRIGGER, "max-w-40", className)}>
      <ModeIcon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{mode.label}</span>
      <ChevronDownSmall className="size-4 shrink-0 text-text-tertiary" aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label="对话模式" placement="top start" dialogClassName="max-h-[min(420px,70dvh)] overflow-y-auto">
      <DropdownGroup label="对话模式">
        {modes.map((item) => { const Icon = modeIcons[item.id]; return <DropdownItem key={item.id} selected={mode.id === item.id} onSelect={() => {
          state.setDraft((draft) => selectComposerMode(draft, item.id as ComposerMode));
          setOpen(false);
        }} className="items-start gap-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body-medium">{item.label}</span>
            <span className="text-caption-1-regular text-text-tertiary">{item.description}</span>
          </span>
          {mode.id === item.id && <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
        </DropdownItem>; })}
      </DropdownGroup>
      <DropdownDivider />
      <p className="px-2 pb-1 text-caption-1-regular text-text-tertiary">
        {context === "official" ? "官方人物仅支持聊天和学习。" : context === "workspace" ? "Auto 路由、学习与 Agent 执行服务尚未接入。" : "专业协助使用此联系人的提示词；学习服务尚未接入。"}
      </p>
    </DropdownPopover>
  </Dropdown>;
}
