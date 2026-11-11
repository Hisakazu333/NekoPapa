import { ComposerLoader } from "@/components/application/composer-loader/composer-loader";
import { AgentThinking } from "@/components/application/agent-thinking/agent-thinking";
import { ArrowUpIcon, SmileIcon, StopFilledIcon } from "@/components/foundations/icons/app-icons";
import { useSendKey } from "@/hooks/use-send-key";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/base/buttons/button";
import { Dropdown, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { ComposerAddMenu } from "../chat-composer/composer-add-menu";
import { ComposerModelMenu } from "../chat-composer/composer-model-menu";
import { ComposerDraftSummary } from "../chat-composer/composer-draft-summary";
import { ComposerModeMenu } from "../chat-composer/composer-mode-menu";
import { ComposerPermissionMenu } from "../chat-composer/composer-permission-menu";
import { ProjectDirectorySelector } from "../chat-composer/project-directory-selector";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import type { ComposerContext } from "@/app/chat/chat-composer-draft";

interface ContactComposerProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onConfigure: (returnFocusTarget?: HTMLElement | null) => void;
  busy: boolean;
  activityLabel?: string;
  ready: boolean;
  composer: ChatComposerState;
  sendBlockedReason?: string;
  officialCompanion?: boolean;
  context?: ComposerContext;
  /** Status tab content after the mode menu, e.g. project, branch and context meter. */
  status?: ReactNode;
}

/** The prompt grows a line at a time with its text, up to ten lines, then scrolls. */
const MAX_LINES = 10;
function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input) return;
    const style = getComputedStyle(input);
    const line = parseFloat(style.lineHeight) || 20;
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    input.style.height = "auto";
    const height = Math.min(input.scrollHeight, line * MAX_LINES + padding);
    input.style.height = `${height}px`;
    input.style.overflowY = input.scrollHeight > height ? "auto" : "hidden";
  }, [ref, value]);
}

export function ContactComposer({ name, value, onChange, onSend, onStop, onConfigure, busy, activityLabel, ready, composer, sendBlockedReason, officialCompanion, context, status }: ContactComposerProps) {
  const composing = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [emojisOpen, setEmojisOpen] = useState(false);
  const composerContext = context ?? (officialCompanion ? "official" : "custom");
  const blockedReason = (officialCompanion ? composer.draftBlockReason : composer.blockReason) ?? sendBlockedReason;
  const canSend = ready && !busy && !blockedReason && Boolean(value.trim());
  const handleSendKey = useSendKey(composing);
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { handleSendKey(event, () => { if (canSend) onSend(); }); };
  useAutoGrow(inputRef, value);

  // Composer-panel layout (after BoardUI's Pro Composer Panel): a status tab
  // tucked behind the top edge of the input card, inset from its sides with
  // only its top corners round, holds the mode and where the chat works; the
  // card holds the prompt and the add / permission / model / emoji / send
  // controls. Why sending is blocked reads under the card.
  return <div className="relative mx-2 mb-2 flex shrink-0 flex-col">
    {activityLabel && <AgentThinking variant="wave" label={activityLabel} className="mx-3 mb-1 px-2 py-1" />}
    <div aria-label="对话工具栏" className="mx-4 -mb-3 flex min-h-[34px] min-w-0 items-center gap-1 rounded-t-2xl bg-background-tertiary-default px-1.5 pb-3 pt-1 sm:mx-7">
      <ComposerModeMenu state={composer} context={composerContext} disabled={busy} />
      {composerContext === "workspace" && composer.draft.mode === "agent" && <ProjectDirectorySelector state={composer} disabled={busy} />}
      {status}
    </div>
    <ComposerLoader active={busy} radius={24} surface={false} className="z-1 rounded-3xl bg-background-full shadow-xs">
      <div className="relative flex flex-col gap-1 rounded-3xl border border-border-button-default p-2.5">
        <ComposerDraftSummary state={composer} disabled={busy} />
        <textarea ref={inputRef} aria-label={`给${name}发消息`} placeholder={`给${name}发消息…`} value={value}
          onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown}
          onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
          className="w-full resize-none overflow-hidden bg-transparent px-1.5 py-1.5 text-body-regular text-text-primary outline-none placeholder:text-text-tertiary" rows={1} />
        <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-1 sm:gap-2">
          <ComposerAddMenu state={composer} disabled={busy} official={officialCompanion} />
          <ComposerPermissionMenu state={composer} disabled={busy} />
          <div className="min-w-0 flex-1" />
          {!officialCompanion && <ComposerModelMenu state={composer} onConfigure={onConfigure} disabled={busy} />}
          <Dropdown isOpen={emojisOpen} onOpenChange={setEmojisOpen}>
            <DropdownTrigger aria-label="选择表情" isDisabled={busy} className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-icon-secondary outline-none hover:bg-background-tertiary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring">
              <SmileIcon className="size-5" aria-hidden />
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
          {busy ? <Button variant="secondary" iconOnly leadingIcon={StopFilledIcon} aria-label="停止回复" className="rounded-full" onClick={onStop} />
            : <Button iconOnly leadingIcon={ArrowUpIcon} aria-label="发送消息" title="发送消息" className="rounded-full disabled:bg-background-primary-disabled disabled:text-text-tertiary" disabled={!canSend} onClick={() => { if (canSend && !composing.current) onSend(); }} />}
        </div>
      </div>
    </ComposerLoader>
    {blockedReason && <p role="status" title={blockedReason} className="mx-4 mt-1.5 truncate text-caption-1-regular text-text-tertiary sm:mx-7">{blockedReason}</p>}
  </div>;
}
