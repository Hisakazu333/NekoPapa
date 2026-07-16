import { type FormEvent, useEffect, useState } from "react";
import {
  Archive,
  Bot,
  Clock3,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import { IconButton, PageHeading } from "../components/ui";

interface Message {
  id: number;
  role: "assistant" | "user";
  text: string;
}

const initialMessages: Message[] = [
  {
    id: 1,
    role: "assistant",
    text: "会话服务尚未连接。当前窗口可用于检查消息布局与本地输入状态。",
  },
];

interface ConversationPageProps {
  initialMessage?: { id: number; text: string } | null;
  onInitialMessageConsumed?: () => void;
}

export function ConversationPage({
  initialMessage,
  onInitialMessageConsumed,
}: ConversationPageProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  useEffect(() => {
    if (!initialMessage) return;

    setMessages((current) => current.some(({ id }) => id === initialMessage.id)
      ? current
      : [...current, { ...initialMessage, role: "user" }]);
    onInitialMessageConsumed?.();
  }, [initialMessage, onInitialMessageConsumed]);

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setMessages((current) => [...current, { id: Date.now(), role: "user", text }]);
    setDraft("");
  };

  return (
    <div className="page conversation-page">
      <PageHeading
        eyebrow="本地会话"
        title="对话"
        description="管理当前同伴的会话、上下文与输入。"
        actions={
          <button type="button" className="button button--primary">
            <Plus size={16} aria-hidden="true" />新会话
          </button>
        }
      />

      <div className="conversation-workspace">
        <aside className="conversation-sidebar">
          <label className="search-field">
            <Search size={15} aria-hidden="true" />
            <input type="search" placeholder="搜索会话" aria-label="搜索会话" />
          </label>
          <div className="sidebar-section-label">最近</div>
          <button type="button" className="thread-row thread-row--active">
            <MessageCircle size={16} aria-hidden="true" />
            <span><strong>新会话</strong><small>尚无已同步消息</small></span>
            <Clock3 size={13} aria-hidden="true" />
          </button>
          <div className="sidebar-empty">
            <Archive size={18} aria-hidden="true" />
            <span>没有归档会话</span>
          </div>
        </aside>

        <section className="chat-panel">
          <header className="chat-panel__header">
            <div className="companion-identity">
              <span className="avatar avatar--accent"><Bot size={17} aria-hidden="true" /></span>
              <span><strong>当前同伴</strong><small>模型未选择</small></span>
            </div>
            <IconButton label="会话菜单"><MoreHorizontal size={18} /></IconButton>
          </header>

          <div className="message-list" aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={`message message--${message.role}`}>
                <span className="avatar">
                  {message.role === "assistant" ? <Bot size={16} /> : <UserRound size={16} />}
                </span>
                <div className="message__body">
                  <strong>{message.role === "assistant" ? "OpenNeko" : "你"}</strong>
                  <p>{message.text}</p>
                </div>
              </article>
            ))}
          </div>

          <form className="chat-composer" onSubmit={submitMessage}>
            <div className="chat-composer__tools">
              <IconButton label="添加附件"><Paperclip size={17} /></IconButton>
              <IconButton label="语音输入" disabled><Mic size={17} /></IconButton>
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="输入消息"
              aria-label="消息内容"
              rows={1}
            />
            <button className="send-button" type="submit" aria-label="发送消息" title="发送消息" disabled={!draft.trim()}>
              <Send size={17} aria-hidden="true" />
            </button>
          </form>
        </section>

        <aside className="context-panel">
          <div className="context-panel__header">
            <Sparkles size={16} aria-hidden="true" />
            <h2>会话上下文</h2>
          </div>
          <dl className="property-list">
            <div><dt>角色</dt><dd>未选择</dd></div>
            <div><dt>记忆注入</dt><dd>未连接</dd></div>
            <div><dt>上下文窗口</dt><dd>--</dd></div>
          </dl>
          <div className="context-block">
            <strong>情绪状态</strong>
            <p>等待 NekoCore 状态流。</p>
          </div>
          <div className="context-block">
            <strong>工具调用</strong>
            <p>当前会话没有工具活动。</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
