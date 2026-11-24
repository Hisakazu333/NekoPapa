import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUpIcon, SparkleIcon, BookOpenIcon, CompassIcon, LightbulbIcon, ListChecksIcon, MessageCircleHeartIcon, PencilIcon, RefreshCwIcon } from "@/components/foundations/icons/app-icons";
import type { ChatContact } from "@/app/contacts/contacts-store";
import type { OpenWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import { ComposerAddMenu } from "../chat-composer/composer-add-menu";
import { ComposerModelMenu } from "../chat-composer/composer-model-menu";
import { ComposerDraftSummary } from "../chat-composer/composer-draft-summary";
import { HomeContactsMenu } from "./home-contacts-menu";
import { HomeProjectMenu } from "./home-project-menu";
import { ComposerModeMenu } from "../chat-composer/composer-mode-menu";
import { ComposerPermissionMenu } from "../chat-composer/composer-permission-menu";
import { useSendKey } from "@/hooks/use-send-key";
import { homeGreeting } from "./chat-home-greeting";
import { HomeSendStatus } from "./home-send-status";
import "@/styles/chat-home.css";

const modes = [
  { id: "chat", label: "聊天", prefix: "" },
  { id: "explain", label: "解释", prefix: "请用通俗易懂的语言解释以下内容：\n" },
  { id: "write", label: "写作", prefix: "请帮我完善下面的文字，让表达更清楚自然：\n" },
  { id: "plan", label: "计划", prefix: "请将以下目标整理成可执行的计划：\n" },
  { id: "code", label: "编程", prefix: "请协助分析以下编程问题，并说明实现思路：\n" },
] as const;
const shortcuts = [
  { label: "解释一个概念，配上生活中的例子", icon: LightbulbIcon, mode: "explain", prompt: "一个我正在学习的概念，并举一个生活中的例子。" },
  { label: "帮我把想法写得更清楚自然", icon: PencilIcon, mode: "write", prompt: "我想表达的想法是：" },
  { label: "把一个目标整理成可执行的计划", icon: ListChecksIcon, mode: "plan", prompt: "我想完成的目标是：" },
  { label: "研究一个问题，列出要验证的事实", icon: BookOpenIcon, mode: "chat", prompt: "帮我研究一个问题：先梳理关键概念、需要验证的事实，以及可以继续查找的资料。问题是：" },
] as const;
const officialIdeas = [
  { label: "聊聊今天发生的事", icon: MessageCircleHeartIcon, prompt: "今天想和你聊聊发生的事。" },
  { label: "陪我放松一下", icon: CompassIcon, prompt: "陪我放松一下，聊点轻松的话题吧。" },
] as const;

const ideas = [
  "有哪些小习惯，可以让我的一天更从容？",
  "帮我把一个复杂的问题，拆成三个可以开始的小步骤。",
  "如果用生活中的例子来解释傅里叶变换，会是什么样？",
  "和我一起想一想，这个周末可以做点什么有趣的事？",
];

export interface ChatHomeProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (text?: string) => void;
  disabled: boolean;
  sendBlockedReason?: string;
  onOpenSettings: OpenWorkspaceSettings;
  onSelectContact: (contact: ChatContact) => void;
  onClearContact: () => void;
  selectedContact?: ChatContact;
  composer: ChatComposerState;
  /** Project folder of the workbench chat; contact chats have none. */
  project?: string;
  onProjectChange: (projectId: string | undefined) => void;
}


export function ChatHome({ value, onValueChange, onSubmit, disabled, sendBlockedReason, onOpenSettings, onSelectContact, onClearContact, selectedContact, composer, project, onProjectChange }: ChatHomeProps) {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const [salutation] = useState(() => homeGreeting(new Date().getHours(), Math.random()));
  const [ideaIndex, setIdeaIndex] = useState(0);
  const canSend = !disabled && value.trim().length > 0;
  const official = selectedContact?.kind === "official";

  const fill = (next: string) => {
    onValueChange(next);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(next.length, next.length);
    });
  };
  const fillIdea = () => {
    fill(ideas[ideaIndex]);
  };
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (canSend) onSubmit(value);
  };
  const handleSendKey = useSendKey(composing);
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { handleSendKey(event, submit); };

  return (
    <section className="chat-home" aria-labelledby={titleId}>
      <div className="chat-home__greeting">
        <img className="chat-home__cat" src="/brand/nekopapa-app-icon-v1-128.png" alt="" />
        <h1 id={titleId}>{salutation}</h1>
      </div>

      <div className="chat-home__entry">
        <form className="chat-home__composer" onSubmit={submit}>
          <ComposerDraftSummary state={composer} />
          <label className="sr-only" htmlFor={inputId}>{selectedContact ? `发送消息给 ${selectedContact.name}` : "发送消息给 NekoPapa"}</label>
          <textarea
            id={inputId}
            ref={inputRef}
            className="chat-home__textarea"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={onKeyDown}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={() => { composing.current = false; }}
            placeholder={selectedContact ? `发送消息给${selectedContact.name}…` : "今天有什么想聊的？"}
            rows={4}
            aria-describedby={disabled ? `${inputId}-connection` : undefined}
          />
          <div className="chat-home__composer-actions">
            <div className="chat-home__composer-tools">
              <ComposerAddMenu state={composer} official={official} onOpenTools={official ? undefined : () => onOpenSettings("tools")} />
              {/* Permission only matters once Agent can act in a project folder. */}
              {!selectedContact && project && <ComposerPermissionMenu state={composer} />}
            </div>
            <div className="chat-home__send-actions">
              {!official && <ComposerModelMenu state={composer} onConfigure={(target) => onOpenSettings("model", target)} />}
              <button type="submit" className="chat-home__send-button" disabled={!canSend} aria-label="发送消息" title={sendBlockedReason ?? (disabled ? "连接模型后即可发送" : "发送消息")}>
                <ArrowUpIcon aria-hidden />
              </button>
            </div>
          </div>
        </form>

        <div className="chat-home__toolbar">
          <div className="chat-home__toolbar-group">
            {!selectedContact && <HomeProjectMenu value={project} onChange={onProjectChange} />}
            {selectedContact && <ComposerModeMenu state={composer} context={selectedContact.kind} className="chat-home__toolbar-button" />}
          </div>
          <div className="chat-home__toolbar-group">
            <HomeContactsMenu onSelectContact={onSelectContact} onClearContact={onClearContact} selectedContact={selectedContact} />
          </div>
        </div>
      </div>

      {official && <p className="mt-3 text-center text-caption-1-regular text-text-tertiary">官方人物使用固定设定，仅用于单人陪伴聊天和学习。学习模式尚未接入。</p>}

      {disabled && <HomeSendStatus id={`${inputId}-connection`} reason={sendBlockedReason} official={official}
        canConfigure={!composer.usesProfile} onConfigure={() => onOpenSettings("model")} onLeaveContact={onClearContact} />}

      <div className="chat-home__ideas" role="group" aria-labelledby={`${titleId}-ideas`}>
        <div className="chat-home__ideas-header">
          <span id={`${titleId}-ideas`}>给你一点灵感</span>
        </div>
        {official
          ? officialIdeas.map(({ label, icon: Icon, prompt }) => <button type="button" key={label} className="chat-home__idea" onClick={() => fill(prompt)}>
            <span className="chat-home__idea-icon"><Icon aria-hidden /></span><span className="chat-home__idea-text">{label}</span>
          </button>)
          : <>
            {shortcuts.map(({ label, icon: Icon, mode: modeId, prompt }) => <button type="button" key={label} className="chat-home__idea" onClick={() => {
              const next = modes.find((entry) => entry.id === modeId)!;
              fill(next.prefix + prompt);
            }}>
              <span className="chat-home__idea-icon"><Icon aria-hidden /></span><span className="chat-home__idea-text">{label}</span>
            </button>)}
            <div className="flex items-center">
              <button type="button" className="chat-home__idea" onClick={fillIdea}>
                <span className="chat-home__idea-icon"><SparkleIcon aria-hidden /></span><span className="chat-home__idea-text">{ideas[ideaIndex]}</span>
              </button>
              <button type="button" className="chat-home__icon-button" aria-label="换一个灵感" title="换一个灵感"
                onClick={() => setIdeaIndex((current) => (current + 1) % ideas.length)}><RefreshCwIcon aria-hidden /></button>
            </div>
          </>}
      </div>
    </section>
  );
}
