import { useState, type RefObject } from "react";
import type { UIMessage } from "ai";
import { AgentMessage } from "@/components/application/agent-chat/agent-chat-message";
import { AgentComposer } from "@/components/application/agent-chat/agent-composer";
import type { ChatContact } from "@/app/contacts/contacts-store";
import type { OpenWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import { cx } from "@/utils/cx";
import { TranscriptViewport } from "./transcript-viewport";
import { ChatHome } from "./chat-home";
import { messageReasoning, messageText } from "./thread-storage";
import { ComposerStatusTab } from "./composer-status-tab";
import type { Project } from "@/app/projects/projects";
import type { ThreadUsage } from "@/app/usage/thread-usage";
import { ConversationViewBar, type ConversationView } from "./trajectory/conversation-view-bar";
import { TrajectoryView } from "./trajectory/trajectory-view";
import { runActivity } from "@/app/agent/run-activity";
import { readStepLimit } from "@/app/agent/step-limit";
import { ComposerQueue } from "./composer-queue";
import { ContextCompactionNote } from "./context-compaction-note";
import { readCompaction } from "@/app/chat/context-compaction";
import type { MessageQueue } from "./use-message-queue";

export interface ChatConversationProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  conversationId: string;
  active: boolean;
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
  /** Messages typed while a reply runs (use-message-queue.ts). */
  queue: MessageQueue;
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
  /** The chat's resolved project, for the status bar under the composer. */
  projectInfo?: Project;
  onOpenChanges: () => void;
  usage: ThreadUsage;
}

/**
 * The open chat's body: the home screen while it is empty, otherwise the
 * 对话 / 轨迹 views of the same chat with the composer pinned underneath.
 * State stays with AgentChat; this only lays it out. The view resets to 对话
 * when another chat opens.
 */
export function ChatConversation({
  scrollRef, conversationId, active, messages, messageAt, busy, showThinking, error, historyError, onRetryHistory,
  input, onInputChange, onSubmit, onStop, queue, composer, onOpenSettings, sendDisabled, sendBlockedReason,
  contact, onSelectContact, onClearContact, project, onProjectChange, projectInfo, onOpenChanges, usage,
}: ChatConversationProps) {
  const empty = messages.length === 0;
  const [viewState, setViewState] = useState<{ id: string; view: ConversationView }>({ id: conversationId, view: "chat" });
  const view = viewState.id === conversationId && !empty ? viewState.view : "chat";
  const setView = (next: ConversationView) => setViewState({ id: conversationId, view: next });
  const jumpTo = (messageId: string) => {
    setView("chat");
    // The transcript mounts again at the latest message; jump once that settled.
    requestAnimationFrame(() => requestAnimationFrame(() =>
      scrollRef.current?.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)?.scrollIntoView({ block: "start" })));
  };
  return <>
    {!empty && <ConversationViewBar view={view} onChange={setView} />}
    {view === "trace" ? <TrajectoryView messages={messages} messageAt={messageAt} onJump={jumpTo} /> : <TranscriptViewport viewportRef={scrollRef} conversationId={conversationId} busy={busy} active={active} showLatest={!empty}>
      <div className={cx(
        "mx-auto flex w-full flex-col gap-5 pb-6 pt-6",
        empty ? "flex-1 max-w-[1000px] justify-center px-5 sm:px-10 lg:px-12" : "max-w-3xl px-4",
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
          // The wrapper is the 目录 panel's jump target (data-message-id).
          <div key={message.id} data-message-id={message.id} className="flex scroll-mt-20 flex-col gap-5">
            {message.role === "assistant" && <CompactionMark metadata={message.metadata} />}
            <AgentMessage
              role={message.role}
              text={messageText(message)}
              reasoning={message.role === "assistant" ? messageReasoning(message) : undefined}
              parts={message.parts}
              streaming={busy && index === messages.length - 1}
              at={messageAt[message.id]}
              stepLimit={!busy && index === messages.length - 1 && readStepLimit(message.metadata)}
            />
          </div>
        ))}

        {Boolean(error) && (
          <p role="alert" className="px-1 text-body-regular text-text-tertiary">
            Something went wrong. Check the server logs, then try again.
          </p>
        )}
      </div>
    </TranscriptViewport>}

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
          queueing
          above={<ComposerQueue queue={queue} />}
          mentionRoot={contact ? undefined : projectInfo?.folders[0]}
          activityLabel={contact ? (showThinking ? "正在等待回复" : undefined) : runActivity(messages, busy)}
          composer={composer}
          onConfigure={(target) => onOpenSettings("model", target)}
          officialCompanion={contact?.kind === "official"}
          context={contact?.kind ?? "workspace"}
          name={contact?.name ?? "NekoPapa"}
          disabled={sendDisabled}
          sendBlockedReason={sendBlockedReason}
          status={contact ? undefined : <ComposerStatusTab project={projectInfo} usage={usage} onOpenChanges={onOpenChanges} />}
        />}
      </div>
    </div>
  </>;
}

function CompactionMark({ metadata }: { metadata: unknown }) {
  const compaction = readCompaction(metadata);
  return compaction ? <ContextCompactionNote compaction={compaction} /> : null;
}
