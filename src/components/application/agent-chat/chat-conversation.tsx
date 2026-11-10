import type { RefObject } from "react";
import type { UIMessage } from "ai";
import { AgentMessage } from "@/components/application/agent-chat/agent-chat-message";
import { AgentComposer } from "@/components/application/agent-chat/agent-composer";
import { AgentThinking } from "@/components/application/agent-thinking/agent-thinking";
import type { ChatContact } from "@/app/contacts-store";
import type { OpenWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import { cx } from "@/utils/cx";
import { ChatHome } from "./chat-home";
import { messageText } from "./thread-storage";

export interface ChatConversationProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  messages: UIMessage[];
  messageAt: Record<string, number | undefined>;
  busy: boolean;
  showThinking: boolean;
  error?: unknown;
  historyError?: string | null;
  onRetryHistory: () => void;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
  onStop: () => void;
  composer: ChatComposerState;
  onOpenSettings: OpenWorkspaceSettings;
  /** Sending is off: no ready model, or the chosen mode has no service yet. */
  sendDisabled: boolean;
  sendBlockedReason?: string;
  contact?: ChatContact;
  onSelectContact: (contact: ChatContact) => void;
  onClearContact: () => void;
  project?: string;
  onProjectChange: (projectId: string | undefined) => void;
}

/**
 * The open chat's body: the home screen while it is empty, otherwise the
 * transcript with the composer pinned underneath. State stays with AgentChat;
 * this only lays it out.
 */
export function ChatConversation({
  scrollRef, messages, messageAt, busy, showThinking, error, historyError, onRetryHistory,
  input, onInputChange, onSubmit, onStop, composer, onOpenSettings, sendDisabled, sendBlockedReason,
  contact, onSelectContact, onClearContact, project, onProjectChange,
}: ChatConversationProps) {
  const empty = messages.length === 0;
  return <>
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
      <div className={cx(
        "mx-auto flex w-full flex-col gap-5 pb-6 pt-6",
        empty ? "min-h-full max-w-[1000px] justify-center px-5 sm:px-10 lg:px-12" : "max-w-3xl px-4",
      )}>
        {empty ? (
          <ChatHome
            value={input}
            onValueChange={onInputChange}
            onSubmit={(text) => onSubmit(text ?? input)}
            disabled={sendDisabled}
            sendBlockedReason={sendBlockedReason}
            onOpenSettings={onOpenSettings}
            onSelectContact={onSelectContact}
            onClearContact={onClearContact}
            selectedContact={contact}
            composer={composer}
            project={project}
            onProjectChange={onProjectChange}
          />
        ) : messages.map((message, index) => (
          <AgentMessage
            key={message.id}
            role={message.role}
            text={messageText(message)}
            streaming={busy && index === messages.length - 1}
            at={messageAt[message.id]}
          />
        ))}

        {showThinking && <AgentThinking variant="wave" label="Thinking" className="px-1" />}

        {Boolean(error) && (
          <p role="alert" className="px-1 text-body-regular text-text-tertiary">
            Something went wrong. Check the server logs, then try again.
          </p>
        )}
      </div>
    </div>

    <div className="shrink-0 px-3 pb-3">
      <div className="mx-auto w-full max-w-3xl">
        {historyError && (
          <p role="alert" className="mb-2 text-body-2-medium text-text-secondary">
            {historyError} <button type="button" className="underline" onClick={onRetryHistory}>重试</button>
          </p>
        )}
        {!empty && <AgentComposer
          value={input}
          onValueChange={onInputChange}
          onSubmit={() => onSubmit(input)}
          onStop={onStop}
          busy={busy}
          composer={composer}
          onConfigure={(target) => onOpenSettings("model", target)}
          officialCompanion={contact?.kind === "official"}
          context={contact?.kind ?? "workspace"}
          name={contact?.name ?? "NekoPapa"}
          disabled={sendDisabled}
          sendBlockedReason={sendBlockedReason}
        />}
      </div>
    </div>
  </>;
}
