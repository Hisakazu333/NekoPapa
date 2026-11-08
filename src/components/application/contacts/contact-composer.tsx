import { RiArrowUpLine, RiEmotionHappyLine, RiStopFill } from "@remixicon/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/base/buttons/button";
import { Dropdown, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { ComposerAddMenu } from "../chat-composer/composer-add-menu";
import { ComposerModelMenu } from "../chat-composer/composer-model-menu";
import { ComposerDraftSummary } from "../chat-composer/composer-draft-summary";
import { ComposerModeMenu } from "../chat-composer/composer-mode-menu";
import { ComposerPermissionMenu } from "../chat-composer/composer-permission-menu";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import type { ComposerContext } from "@/app/chat-composer-draft";

interface ContactComposerProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onConfigure: (returnFocusTarget?: HTMLElement | null) => void;
  busy: boolean;
  ready: boolean;
  composer: ChatComposerState;
  sendBlockedReason?: string;
  officialCompanion?: boolean;
  context?: ComposerContext;
}

export function ContactComposer({ name, value, onChange, onSend, onStop, onConfigure, busy, ready, composer, sendBlockedReason, officialCompanion, context }: ContactComposerProps) {
  const composing = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [emojisOpen, setEmojisOpen] = useState(false);
  const blockedReason = (officialCompanion ? composer.draftBlockReason : composer.blockReason) ?? sendBlockedReason;
  const canSend = ready && !busy && !blockedReason && Boolean(value.trim());
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  return <div className="relative mx-2 mb-2 flex shrink-0 flex-col rounded-3xl border border-border-button-default bg-background-primary-default">
    <div className="relative z-1 flex flex-col gap-2 rounded-3xl border border-border-button-white bg-background-full p-3 shadow-xs">
    <ComposerDraftSummary state={composer} disabled={busy} />
    <textarea ref={inputRef} aria-label={`给${name}发消息`} placeholder={`给${name}发消息…`} value={value}
      onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown}
      onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
      className="min-h-20 w-full resize-none bg-transparent px-1 py-2 text-body-regular text-text-primary outline-none placeholder:text-text-tertiary" rows={3} />
    <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-1 sm:gap-2">
      <ComposerAddMenu state={composer} disabled={busy} official={officialCompanion} />
      <ComposerPermissionMenu state={composer} disabled={busy} />
      <div className="min-w-0 flex-1" />
      <ComposerModelMenu state={composer} onConfigure={onConfigure} disabled={busy} official={officialCompanion} />
      {busy ? <Button variant="secondary" iconOnly leadingIcon={RiStopFill} aria-label="停止回复" className="rounded-full" onClick={onStop} />
        : <Button iconOnly leadingIcon={RiArrowUpLine} aria-label="发送消息" title="发送消息" className="rounded-full disabled:bg-background-primary-disabled disabled:text-text-tertiary" disabled={!canSend} onClick={() => { if (canSend && !composing.current) onSend(); }} />}
    </div>
    </div>
    <div aria-label="对话工具栏" className="flex min-h-11 items-center justify-between gap-2 px-3 py-1">
      <ComposerModeMenu state={composer} context={context ?? (officialCompanion ? "official" : "custom")} disabled={busy} />
      <Dropdown isOpen={emojisOpen} onOpenChange={setEmojisOpen}>
        <DropdownTrigger aria-label="选择表情" isDisabled={busy} className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-icon-secondary outline-none hover:bg-background-tertiary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring">
          <RiEmotionHappyLine className="size-5" aria-hidden />
        </DropdownTrigger>
        <DropdownPopover aria-label="选择表情" placement="top start" className="w-auto rounded-2xl" dialogClassName="p-2">
          <div role="group" aria-label="表情" className="grid grid-cols-6 gap-1">
            {["😊", "👍", "✨", "🐱", "❤️", "🎉"].map((emoji) => <button key={emoji} type="button" aria-label={`插入${emoji}`} className="size-9 cursor-pointer rounded-lg text-xl outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring" onClick={() => {
              const input = inputRef.current;
              const start = input?.selectionStart ?? value.length;
              const end = input?.selectionEnd ?? start;
              onChange(value.slice(0, start) + emoji + value.slice(end));
              setEmojisOpen(false);
              requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + emoji.length, start + emoji.length); });
            }}>{emoji}</button>)}
          </div>
        </DropdownPopover>
      </Dropdown>
    </div>
    {blockedReason && <p role="status" className="px-4 pb-2 text-caption-1-regular text-text-tertiary">{blockedReason}</p>}
  </div>;
}

