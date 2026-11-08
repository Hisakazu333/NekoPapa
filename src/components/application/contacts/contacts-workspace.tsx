import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { RiChat3Line, RiGroupLine, RiMenuLine, RiSearchLine } from "@remixicon/react";
import type { GroupChat } from "@/app/group-chat-store";
import type { ChatContact } from "@/app/contacts-store";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Input } from "@/components/base/input/input";
import { ResizableDivider } from "@/components/base/resizable-divider/resizable-divider";
import { useContacts } from "@/hooks/use-contacts";
import { useContactSections } from "@/hooks/use-contact-sections";
import { cx } from "@/utils/cx";
import { ContactActionsMenu } from "./contact-actions-menu";
import { ContactSection } from "./contact-section";
import { GroupChatMenu } from "./group-chat-menu";
import { ContactRowMenu } from "./contact-row-menu";

export type { ChatContact } from "@/app/contacts-store";

export interface ContactPreview {
  text: string;
  updatedAt: number;
  busy?: boolean;
}

export interface ContactsWorkspaceProps {
  onSelect: (contact: ChatContact) => void;
  selectedId?: string;
  disabled?: boolean;
  previews?: Record<string, ContactPreview>;
  onNavigate?: () => void;
  onCreate: () => void;
  onStartGroup: () => void;
  groups: GroupChat[];
  onSelectGroup: (group: GroupChat) => void;
  onDeleteGroup: (group: GroupChat) => void;
  onDeleteContact: (contact: ChatContact) => void;
  onEditContact: (contact: ChatContact) => void;
  searchInputRef?: Ref<HTMLInputElement>;
  query: string;
  onQueryChange: (query: string) => void;
  groupNotice?: string | null;
  onRetryGroups?: () => void;
  children?: ReactNode;
}

function previewDate(timestamp: number | undefined) {
  if (!timestamp || !Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "昨天";
  return date.toLocaleDateString("zh-CN", { year: date.getFullYear() === today.getFullYear() ? undefined : "numeric", month: "numeric", day: "numeric" });
}

function ContactRow({ contact, selected, disabled, preview, onSelect, onButtonRef, onDelete, onEdit }: {
  contact: ChatContact;
  selected: boolean;
  disabled: boolean;
  preview?: ContactPreview;
  onSelect: (contact: ChatContact, button: HTMLButtonElement) => void;
  onButtonRef: (id: string, button: HTMLButtonElement | null) => void;
  onDelete: (contact: ChatContact) => void;
  onEdit: (contact: ChatContact) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const recent = preview?.busy ? "正在回复…" : preview?.text.trim() || contact.description || "自建联系人";
  const date = previewDate(preview?.updatedAt);
  const contextMenu = () => { if (contact.kind === "custom" && !disabled) setMenuOpen(true); };
  return <div onContextMenu={(event) => { if (contact.kind === "custom" && !disabled) { event.preventDefault(); contextMenu(); } }}
    onKeyDown={(event) => { if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { event.preventDefault(); contextMenu(); } }}
    className={cx("group flex min-w-0 items-center rounded-xl pe-1", selected ? "bg-background-tertiary-default" : "hover:bg-background-secondary-hover")}><button
    type="button"
    ref={(button) => onButtonRef(contact.id, button)}
    onClick={(event) => onSelect(contact, event.currentTarget)}
    disabled={disabled}
    aria-label={`与${contact.name}对话`}
    aria-pressed={selected}
    className={cx(
      "flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-60",
    )}
  >
    <Avatar size="lg" className="size-10" src={contact.avatar} initials={Array.from(contact.name).slice(-1).join("")} alt="" color={contact.avatarColor ?? "neutral"} />
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-body-medium text-text-primary">{contact.name}</span>
        {date && <time dateTime={new Date(preview!.updatedAt).toISOString()} className="shrink-0 text-caption-1-medium text-text-tertiary">{date}</time>}
      </div>
      <p className="truncate text-body-2-regular text-text-secondary">{recent.replace(/\s+/g, " ")}</p>
    </div>
  </button>{contact.kind === "custom" && <ContactRowMenu name={contact.name} open={menuOpen} onOpenChange={setMenuOpen} disabled={disabled} onEdit={() => onEdit(contact)} onDelete={() => onDelete(contact)} />}</div>;
}

export function ContactsWorkspace({ onSelect, selectedId, disabled = false, previews = {}, onNavigate, onCreate, onStartGroup, groups, onSelectGroup, onDeleteGroup, onDeleteContact, onEditContact, searchInputRef, query, onQueryChange, groupNotice, onRetryGroups, children }: ContactsWorkspaceProps) {
  const titleId = useId();
  const paneId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const chatPane = useRef<HTMLDivElement>(null);
  const contactRows = useRef(new Map<string, HTMLButtonElement>());
  const returnFocus = useRef<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [preferredWidth, setPreferredWidth] = useState<number | null>(null);
  const maxWidth = Math.max(220, Math.min(420, containerWidth - 340));
  const listWidth = Math.max(220, Math.min(maxWidth, preferredWidth ?? 280));
  const { contacts, notice, storageAvailable, retry } = useContacts();
  const normalized = query.trim().normalize("NFKC").toLocaleLowerCase();
  const sections = useContactSections(normalized);
  const filtered = contacts.filter((contact) => `${contact.name}\n${contact.description}\n${contact.tags ?? ""}`.normalize("NFKC").toLocaleLowerCase().includes(normalized));
  const official = filtered.filter((contact) => contact.kind === "official");
  const custom = filtered.filter((contact) => contact.kind === "custom");
  const selected = contacts.find((contact) => contact.id === selectedId);
  const filteredGroups = groups.filter((group) => `${group.title}\n${group.members.map((member) => member.name).join(" ")}`.normalize("NFKC").toLocaleLowerCase().includes(normalized));
  const row = (contact: ChatContact) => <ContactRow key={contact.id} contact={contact} selected={contact.id === selectedId} disabled={disabled} preview={previews[contact.id]} onDelete={onDeleteContact} onEdit={onEditContact} onSelect={(item, button) => { returnFocus.current = button; onSelect(item); }} onButtonRef={(id, button) => { if (button) contactRows.current.set(id, button); else contactRows.current.delete(id); }} />;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => setContainerWidth(root.getBoundingClientRect().width));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const frame = requestAnimationFrame(() => {
      if (selectedId) {
        const selectedRow = contactRows.current.get(selectedId);
        if (selectedRow) returnFocus.current = selectedRow;
        chatPane.current?.focus();
      } else {
        if (returnFocus.current?.isConnected && returnFocus.current.getClientRects().length) returnFocus.current.focus();
        else rootRef.current?.querySelector<HTMLInputElement>('input[aria-label="搜索联系人"]')?.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);

  return <section ref={rootRef} aria-label="联系人聊天" style={{ "--contacts-list-width": `${listWidth}px` } as CSSProperties} className="flex h-full min-h-0 min-w-0 flex-1">
    <div className={cx(
      "min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-3xl border border-border-button-white bg-background-secondary-default shadow-sidebar md:w-[var(--contacts-list-width)]",
      selectedId ? "hidden md:flex" : "flex",
    )}>
      <header className="flex shrink-0 flex-col gap-4 p-4 pb-2">
        <div className="flex items-center gap-2">
          {onNavigate && <IconButton icon={RiMenuLine} aria-label="打开导航" onClick={onNavigate} size="small" className="lg:hidden" />}
          <h1 id={titleId} className="min-w-0 flex-1 text-headline-semibold text-text-primary">联系人</h1>
          <ContactActionsMenu disabled={disabled} onCreate={onCreate} onStartGroup={onStartGroup} />
        </div>
        <Input
          ref={searchInputRef}
          aria-label="搜索联系人"
          placeholder="搜索姓名或简介"
          leadingIcon={RiSearchLine}
          value={query}
          onChange={onQueryChange}
          size="small"
        />
      </header>
      <div aria-labelledby={titleId} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        {sections.notice && <p role="status" className="px-3 pt-2 text-caption-1-regular text-text-secondary">{sections.notice}</p>}
        {notice && <div role="status" className="mx-2 mt-3 flex flex-col items-start gap-2 rounded-xl bg-background-secondary-default p-3 text-body-2-regular text-text-secondary">
          <p>{notice}</p>
          {!storageAvailable && <Button variant="secondary" size="small" onClick={retry}>重试</Button>}
        </div>}
        {groupNotice && <div role="alert" className="mx-2 mt-3 flex flex-col items-start gap-2 rounded-xl bg-background-secondary-default p-3 text-body-2-regular text-text-secondary">
          <p>{groupNotice}</p>
          <Button variant="secondary" size="small" onClick={onRetryGroups}>重试群聊记录</Button>
        </div>}
        {filtered.length === 0 && filteredGroups.length === 0 ? <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <RiSearchLine className="size-7 text-foreground-icon-secondary" aria-hidden />
          <p className="text-body-medium text-text-primary">没有找到联系人</p>
          <p className="text-body-2-regular text-text-secondary">试试其他姓名或简介关键词。</p>
          <Button variant="secondary" size="small" onClick={() => onQueryChange("")}>清除搜索</Button>
        </div> : <>
          {filteredGroups.length > 0 && <ContactSection title="群聊" count={filteredGroups.length} collapsed={sections.isCollapsed("groups")} onToggle={() => sections.toggle("groups")}>
            {filteredGroups.map((group) => <div key={group.id} className={cx("flex min-w-0 items-center rounded-xl pe-1", selectedId === group.id ? "bg-background-tertiary-default" : "hover:bg-background-secondary-hover")}>
              <button type="button" ref={(button) => { if (button) contactRows.current.set(group.id, button); else contactRows.current.delete(group.id); }} onClick={(event) => { returnFocus.current = event.currentTarget; onSelectGroup(group); }} aria-pressed={selectedId === group.id}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-start focus-visible:outline-2 focus-visible:outline-border-focus-ring">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background-tertiary-default"><RiGroupLine className="size-5 text-foreground-icon-secondary" aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-body-medium">{group.title}</span><span className="mt-1 block truncate text-body-2-regular text-text-secondary">{group.messages.at(-1)?.text || `${group.members.length} 位联系人 · 开始对话`}</span></span>
              </button>
              <GroupChatMenu title={group.title} onDelete={() => onDeleteGroup(group)} />
            </div>)}
          </ContactSection>}
          {official.length > 0 && <ContactSection title="官方预设" count={official.length} collapsed={sections.isCollapsed("official")} onToggle={() => sections.toggle("official")}>
            <div className="flex flex-col gap-0.5">{official.map(row)}</div>
          </ContactSection>}
          {(custom.length > 0 || !normalized) && <ContactSection title="我的联系人" count={custom.length} collapsed={sections.isCollapsed("custom")} onToggle={() => sections.toggle("custom")}>
            {custom.length > 0 ? <div className="flex flex-col gap-0.5">{custom.map(row)}</div> : <p className="px-3 py-3 text-body-2-regular text-text-secondary">点击右上角 ＋ 新建联系人。</p>}
          </ContactSection>}
        </>}
      </div>
    </div>
    <ResizableDivider label="调整联系人列表宽度" value={listWidth} min={220} max={maxWidth} direction="left" preferredValue={preferredWidth}
      onResize={setPreferredWidth} onReset={() => setPreferredWidth(null)} controls={paneId} className="hidden md:flex" />
    <div ref={chatPane} id={paneId} tabIndex={-1} role="region" aria-label={selected ? `与${selected.name}对话` : "联系人对话"} className={cx(
      "min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-background-secondary-default outline-none",
      selectedId ? "flex" : "hidden md:flex",
    )}>
      {children ?? <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-background-secondary-default">
          <RiChat3Line className="size-8 text-foreground-icon-secondary" aria-hidden />
        </span>
        <p className="text-headline-semibold text-text-primary">选择一位联系人</p>
        <p className="text-body-regular text-text-secondary">从左侧列表开始或继续对话。</p>
      </div>}
    </div>
  </section>;
}
