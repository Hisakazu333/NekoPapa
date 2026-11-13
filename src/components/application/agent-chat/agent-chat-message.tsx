"use client";

import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";

import { CheckIcon, CopyIcon, Volume2Icon, VolumeXIcon } from "@/components/foundations/icons/app-icons";
import { memo, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";

import { cx } from "@/utils/cx";
import { LinkedText } from "./message-links";
import { splitMessageBlocks } from "@/app/chat/message-blocks";
import { MessageMarkdown } from "./message-markdown";
import { MessageRichBlock } from "./message-rich-block";
import { MessageReasoning } from "./message-reasoning";
import type { UIMessage } from "ai";
import { hasToolParts, messageSegments } from "@/app/agent/message-segments";
import { AgentToolCard } from "./agent-tools/agent-tool-card";
import { AgentPlanCard } from "./agent-tools/agent-plan-card";
import { MessagePageElements } from "./message-page-elements";

/**
 * One turn in the transcript.
 *
 * Assistant replies arrive a paragraph at a time, each softening in out of a
 * blur as it first appears and then only growing, so nothing already on screen
 * ever re-animates (message-markdown.tsx).
 *
 * The action row is deliberately mounted at all times and revealed on hover or
 * focus. Rendering it only on hover would make it unreachable by keyboard and
 * would shift the layout as the pointer moves across the transcript.
 */

export interface AgentMessageProps {
  role: string;
  text: string;
  /** True while this message is still being streamed. */
  streaming?: boolean;
  /** When the message first appeared, for the hover timestamp. */
  at?: number;
  /** Reasoning the provider streamed before the answer, if any. */
  reasoning?: string;
  /** The message's parts: a reply's tool calls show in order; a user message's browser annotations show under it. */
  parts?: UIMessage["parts"];
}

/** Memoized: while one reply streams, the earlier turns do not re-render. */
export const AgentMessage = memo(function AgentMessage({ role, text, streaming = false, at, reasoning = "", parts }: AgentMessageProps) {
  const localize = useTemplateCopy();
  const tools = role === "assistant" && parts !== undefined && hasToolParts(parts);
  if (!text && !reasoning.trim() && !tools) return null;

  if (role === "user") {
    return localize((
      <div className="flex flex-col gap-1.5">
        <p className="ms-auto flex w-fit max-w-[75%] flex-col rounded-2xl bg-background-primary-default px-3 py-[11px] text-start text-body-regular break-words whitespace-pre-wrap text-text-primary shadow-card">
          <span translate="no"><LinkedText text={text} /></span>
        </p>
        {parts && <MessagePageElements parts={parts} />}
      </div>
    ));
  }

  return localize((
    <div className="group/message flex flex-col gap-1 px-1">
      <MessageReasoning text={reasoning} streaming={streaming && !text && !tools} />
      {tools ? <ToolReply parts={parts} /> : <ReplyBlocks text={text} />}
      <MessageActions text={text} at={at} hidden={streaming} />
    </div>
  ));
});

/** A reply that used tools: its text runs, tool calls and task checklist in the order they happened. */
function ToolReply({ parts }: { parts: UIMessage["parts"] }) {
  const segments = useMemo(() => messageSegments(parts), [parts]);
  return <div className="flex flex-col gap-2.5">
    {segments.map((segment) => segment.kind === "text" ? <ReplyBlocks key={segment.key} text={segment.text} />
      : segment.kind === "plan" ? <AgentPlanCard key={segment.key} steps={segment.steps} />
        : <AgentToolCard key={segment.key} name={segment.name} part={segment.part} />)}
  </div>;
}

/** Prose as Markdown; fenced blocks as code, diagrams, charts or math (message-rich-block). */
function ReplyBlocks({ text }: { text: string }) {
  // Rendering new tokens yields to scrolling and input; the text catches up
  // in the next idle frame instead of blocking the transcript.
  const shown = useDeferredValue(text);
  const blocks = useMemo(() => splitMessageBlocks(shown), [shown]);
  return <div className="flex flex-col gap-3">
    {blocks.map((block, index) => block.kind === "code"
      ? <MessageRichBlock key={index} lang={block.lang} code={block.code} complete={block.complete} />
      : <MessageMarkdown key={index} text={block.text} />)}
  </div>;
}

function MessageActions({ text, at, hidden }: { text: string; at?: number; hidden: boolean }) {
  const localize = useTemplateCopy();
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  // Speech keeps running if the component goes away mid-sentence, so it is
  // cancelled on unmount rather than left talking over the next screen.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // Silently leaving the icon unchanged is better than a thrown error.
    }
  };

  const toggleSpeech = () => {
    const synth = typeof window === "undefined" ? undefined : window.speechSynthesis;
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(utterance);
    setSpeaking(true);
  };

  return localize((
    <div
      className={cx(
        "flex items-center gap-1 transition-opacity duration-150",
        // Revealed on hover, and whenever a control inside has keyboard focus.
        hidden
          ? "pointer-events-none opacity-0"
          : "opacity-0 group-hover/message:opacity-100 focus-within:opacity-100",
      )}
    >
      <ActionButton label={copied ? "Copied" : "Copy message"} onClick={copy}>
        {copied ? <CheckIcon className="size-4" aria-hidden /> : <CopyIcon className="size-4" aria-hidden />}
      </ActionButton>

      <ActionButton label={speaking ? "Stop reading aloud" : "Read aloud"} onClick={toggleSpeech}>
        {speaking ? (
          <VolumeXIcon className="size-4" aria-hidden />
        ) : (
          <Volume2Icon className="size-4" aria-hidden />
        )}
      </ActionButton>

      {at ? (
        <time dateTime={new Date(at).toISOString()} className="ms-1 text-caption-1-regular text-text-tertiary">
          {formatAgo(at)}
        </time>
      ) : null}
    </div>
  ));
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const localize = useTemplateCopy();
  return localize((
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground-icon-tertiary transition-colors hover:bg-background-primary-default hover:text-foreground-icon-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:outline-none"
    >
      {children}
    </button>
  ));
}

/** "just now", "3 minutes ago", "2 hours ago" — matching how the rail reads. */
function formatAgo(at: number) {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
