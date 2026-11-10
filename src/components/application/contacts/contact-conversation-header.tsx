import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronLeftIcon, CopyIcon, EllipsisIcon, Trash2Icon, UserCogIcon } from "@/components/foundations/icons/app-icons";
import type { ChatContact } from "@/app/contacts/contacts-store";
import { Avatar } from "@/components/base/avatar/avatar";
import { Dropdown, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";

const quietAction = "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground-icon-secondary hover:bg-background-tertiary-default hover:text-text-primary focus-visible:outline-2 focus-visible:outline-border-focus-ring";

export function ContactConversationHeader({ contact, onBack, onOpenProfile, transcript, onStartGroup, onDelete }: {
  contact: ChatContact;
  onBack: () => void;
  onOpenProfile: () => void;
  transcript: string;
  onStartGroup: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const copyAttempt = useRef(0);
  useEffect(() => {
    copyAttempt.current += 1;
    setCopied(false);
    setError("");
  }, [transcript]);
  const copy = async () => {
    const attempt = ++copyAttempt.current;
    setCopied(false);
    setError("");
    try {
      await navigator.clipboard.writeText(transcript);
      if (attempt === copyAttempt.current) setCopied(true);
    } catch {
      if (attempt === copyAttempt.current) setError("复制失败，请检查剪贴板权限后重试。");
    }
  };
  return <>
    <header className="flex h-[76px] shrink-0 items-center gap-2 px-3 sm:px-4">
      <button type="button" aria-label="返回联系人列表" onClick={onBack} className={`${quietAction} md:hidden`}><ChevronLeftIcon className="size-5" aria-hidden /></button>
      <button type="button" aria-label={contact.kind === "official" ? `查看${contact.name}资料` : `编辑${contact.name}`} onClick={onOpenProfile}
        className="flex min-w-0 cursor-pointer items-center gap-2 rounded-full border border-border-button-default bg-background-secondary-default px-3 py-2 text-text-secondary shadow-xs outline-none transition-colors hover:bg-background-tertiary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <Avatar size="xs" src={contact.avatar} initials={Array.from(contact.name).slice(-1).join("")} alt="" color={contact.avatarColor ?? "neutral"} />
        <span className="truncate text-body-medium">{contact.name}</span>
      </button>
      <div className="flex-1" />
      <button type="button" aria-label={copied ? "已复制对话" : "复制对话"} title={copied ? "已复制" : "复制对话"} onClick={() => { void copy(); }} disabled={!transcript} className={`${quietAction} disabled:opacity-40`}>
        {copied ? <CheckIcon className="size-5" aria-hidden /> : <CopyIcon className="size-5" aria-hidden />}
      </button>
      <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownTrigger aria-label="对话选项" className={quietAction}><EllipsisIcon className="size-5" aria-hidden /></DropdownTrigger>
        <DropdownPopover aria-label="对话选项" placement="bottom end" className="w-[280px] rounded-3xl">
          <DropdownGroup label="在这次对话中">
            <DropdownItem onSelect={() => { setMenuOpen(false); onOpenProfile(); }} className="gap-3 py-3">
              <Avatar size="xs" src={contact.avatar} initials={Array.from(contact.name).slice(-1).join("")} alt="" color={contact.avatarColor ?? "neutral"} />
              <span className="truncate">{contact.kind === "official" ? "查看资料" : `编辑 ${contact.name}`}</span>
            </DropdownItem>
            {contact.kind === "custom" && <DropdownItem onSelect={() => { setMenuOpen(false); onStartGroup(); }} className="gap-3 py-3"><UserCogIcon className="size-5" aria-hidden />开始群聊</DropdownItem>}
            {contact.kind === "custom" && <DropdownItem onSelect={() => { setMenuOpen(false); onDelete(); }} className="gap-3 py-3 text-text-error-primary"><Trash2Icon className="size-5" aria-hidden />删除联系人</DropdownItem>}
          </DropdownGroup>
        </DropdownPopover>
      </Dropdown>
    </header>
    {error && <p role="alert" className="px-5 text-caption-1-regular text-text-error-primary">{error}</p>}
  </>;
}
