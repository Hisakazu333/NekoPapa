import type { ToolUIPart } from "ai";
import { FileTextIcon, FolderOpenIcon, SearchIcon, WrenchIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { readCommandResult, readFileChange, readSearchResult } from "@/app/agent/agent-host";
import type { ReadOutput } from "@/app/agent/agent-tools";
import { toolSubject, toolTitle } from "@/app/agent/tool-labels";
import { AgentApprovalCard } from "./agent-approval-card";
import { AgentChangeCard } from "./agent-change-card";
import { AgentCommandCard } from "./agent-command-card";
import { AgentToolRow } from "./agent-tool-row";

const ICONS = { list_files: FolderOpenIcon, read_file: FileTextIcon, search_files: SearchIcon } as const;

const record = (value: unknown) => value !== null && typeof value === "object" ? value as Record<string, unknown> : {};

/**
 * One tool call in a reply, by what it is and where it stands: a waiting
 * approval, a file change with its diff, a command with its output, or a
 * one-line read / list / search. Everything shown comes from the call's own
 * input and the host's result saved with the message.
 */
export function AgentToolCard({ name, part }: { name: string; part: ToolUIPart }) {
  const { state } = part;
  if (state === "approval-requested") {
    return <AgentApprovalCard name={name} input={part.input} approvalId={part.approval.id} reason={part.approval.requestReason} />;
  }
  if (state === "output-denied" || (state === "approval-responded" && !part.approval.approved)) {
    return <AgentToolRow icon={XIcon} title={`已拒绝：${toolTitle(name, part.input, false).replace(/^正在\S*\s*/, "")}`.replace(/：$/, "")} />;
  }
  if (state === "output-error") {
    return <AgentToolRow icon={WrenchIcon} failed title={toolTitle(name, part.input, true)}>
      <p className="whitespace-pre-wrap text-text-error-primary">{part.errorText}</p>
    </AgentToolRow>;
  }
  const finished = state === "output-available";
  if (name === "run_command") {
    return <AgentCommandCard command={toolSubject(name, part.input)} result={finished ? readCommandResult(part.output) : undefined} />;
  }
  if ((name === "write_file" || name === "edit_file") && finished) {
    const change = readFileChange(part.output);
    if (change) return <AgentChangeCard change={change} />;
  }
  const icon = ICONS[name as keyof typeof ICONS] ?? WrenchIcon;
  return <AgentToolRow icon={icon} running={!finished} title={toolTitle(name, part.input, finished)} detail={finished ? outputDetail(name, part.output) : undefined}>
    {finished ? <OutputDetail name={name} output={part.output} /> : undefined}
  </AgentToolRow>;
}

function outputDetail(name: string, output: unknown): string | undefined {
  if (name === "search_files") {
    const result = readSearchResult(output);
    return result ? `${result.hits.length}${result.truncated ? "+" : ""} 处` : undefined;
  }
  if (name === "list_files") {
    const entries = record(output).entries;
    return Array.isArray(entries) ? `${entries.length} 项` : undefined;
  }
  if (name === "read_file") {
    const read = output as ReadOutput;
    return read?.totalLines ? `第 ${read.startLine}–${read.endLine} 行，共 ${read.totalLines} 行` : read?.note;
  }
  return undefined;
}

function OutputDetail({ name, output }: { name: string; output: unknown }) {
  if (name === "search_files") {
    const result = readSearchResult(output);
    if (!result || result.hits.length === 0) return <p>没有找到。</p>;
    return <ul translate="no" className="flex flex-col gap-0.5 font-mono">
      {result.hits.map((hit, index) => <li key={index} className="truncate">
        <span className="text-text-secondary">{hit.path}{hit.line ? `:${hit.line}` : ""}</span>{hit.text && ` ${hit.text}`}
      </li>)}
    </ul>;
  }
  if (name === "list_files") {
    const entries = record(output).entries;
    if (!Array.isArray(entries) || entries.length === 0) return <p>文件夹是空的。</p>;
    return <ul translate="no" className="flex flex-col gap-0.5 font-mono">
      {entries.map((entry, index) => <li key={index} className="truncate">{String(record(entry).name)}{record(entry).kind === "dir" ? "/" : ""}</li>)}
    </ul>;
  }
  return undefined;
}
