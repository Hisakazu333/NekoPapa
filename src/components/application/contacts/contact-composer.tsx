import { RiArrowUpLine, RiEmotionHappyLine, RiStopFill } from "@remixicon/react";
import { useSendKey } from "@/hooks/use-send-key";
import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/base/buttons/button";
import { Dropdown, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { ComposerAddMenu } from "../chat-composer/composer-add-menu";
import { ComposerModelMenu } from "../chat-composer/composer-model-menu";
import { ComposerDraftSummary } from "../chat-composer/composer-draft-summary";
import { ComposerModeMenu } from "../chat-composer/composer-mode-menu";
import { ComposerPermissionMenu } from "../chat-composer/composer-permission-menu";
import { ProjectDirectorySelector } from "../chat-composer/project-directory-selector";
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
  const composerContext = context ?? (officialCompanion ? "official" : "custom");
  const blockedReason = (officialCompanion ? composer.draftBlockReason : composer.blockReason) ?? sendBlockedReason;
  const canSend = ready && !busy && !blockedReason && Boolean(value.trim());
  const handleSendKey = useSendKey(composing);
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { handleSendKey(event, () => { if (canSend) onSend(); }); };

  // Composer-panel layout (after BoardUI's Pro Composer Panel): a tray of
  // conversation context sits behind the top of the input card; the card
  // holds the text and the add / permission / model / emoji / send controls.
  return <div className="relative mx-2 mb-2 flex shrink-0 flex-col">
    <div aria-label="对话工具栏" className="mx-3 flex min-h-9 min-w-0 items-center gap-2 rounded-t-2xl bg-background-secondary-default px-2 pb-3 pt-1 -mb-2.5">
      <ComposerModeMenu state={composer} context={composerContext} disabled={busy} />
      {composerContext === "workspace" && composer.draft.mode === "agent" && <ProjectDirectorySelector state={composer} disabled={busy} />}
      {blockedReason && <p role="status" title={blockedReason} className="ms-auto min-w-0 truncate text-caption-1-regular text-text-tertiary">{blockedReason}</p>}
    </div>
    <div className="relative z-1 flex flex-col gap-1 rounded-3xl border border-border-button-default bg-background-full p-2.5 shadow-xs">
      <ComposerDraftSummary state={composer} disabled={busy} />
      <textarea ref={inputRef} aria-label={`给${name}发消息`} placeholder={`给${name}发消息…`} value={value}
        onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown}
        onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
        className="max-h-48 min-h-12 w-full resize-none bg-transparent px-1.5 py-1.5 text-body-regular text-text-primary outline-none placeholder:text-text-tertiary" rows={2} />
      <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-1 sm:gap-2">
        <ComposerAddMenu state={composer} disabled={busy} official={officialCompanion} />
        <ComposerPermissionMenu state={composer} disabled={busy} />
        <div className="min-w-0 flex-1" />
        <ComposerModelMenu state={composer} onConfigure={onConfigure} disabled={busy} official={officialCompanion} />
          <Dropdown isOpen={emojisOpen} onOpenChange={setEmojisOpen}>
            <DropdownTrigger aria-label="选择表情" isDisabled={busy} className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-icon-secondary outline-none hover:bg-background-tertiary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring">
              <RiEmotionHappyLine className="size-5" aria-hidden />
            </DropdownTrigger>
            <DropdownPopover aria-label="选择表情" placement="top end" className="w-auto rounded-2xl" dialogClassName="p-2">
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
        {busy ? <Button variant="secondary" iconOnly leadingIcon={RiStopFill} aria-label="停止回复" className="rounded-full" onClick={onStop} />
          : <Button iconOnly leadingIcon={RiArrowUpLine} aria-label="发送消息" title="发送消息" className="rounded-full disabled:bg-background-primary-disabled disabled:text-text-tertiary" disabled={!canSend} onClick={() => { if (canSend && !composing.current) onSend(); }} />}
      </div>
    </div>
  </div>;
}

