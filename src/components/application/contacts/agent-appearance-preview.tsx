import { useState } from "react";
import type { ChatContact } from "@/app/contacts/contacts-store";
import { Avatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";

export interface AgentAppearancePreviewProps {
  contact: ChatContact;
  className?: string;
  onAvatarClick?: () => void;
  avatarImporting?: boolean;
}

export function AgentAppearancePreview({ contact, className, onAvatarClick, avatarImporting = false }: AgentAppearancePreviewProps) {
  const [failedSource, setFailedSource] = useState<string>();
  const showImage = contact.avatar && failedSource !== contact.avatar;
  return <section aria-label={`${contact.name}的外观预览`} className={cx("flex shrink-0 flex-col gap-3", className)}>
    <span className="text-caption-1-medium text-text-secondary">外观预览</span>
    <div className="relative flex h-72 min-h-48 w-full items-center justify-center overflow-hidden rounded-xl bg-background-primary-default">
      {showImage
        ? <img src={contact.avatar} alt={`${contact.name}的人物头像`} onError={() => setFailedSource(contact.avatar)} className="h-full w-full object-contain p-4" />
        : <Avatar size="lg" color={contact.avatarColor} initials={Array.from(contact.name).slice(-1).join("")} alt={contact.name} className="size-28 text-5xl" />}
      {onAvatarClick && <button type="button" aria-label={contact.avatarDataUrl ? "更换联系人头像" : "导入联系人头像"}
        disabled={avatarImporting} onClick={onAvatarClick}
        className="absolute inset-0 cursor-pointer rounded-xl outline-none hover:bg-background-secondary-hover/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring disabled:cursor-wait" />}
    </div>
    <p className="text-center text-caption-2-regular text-text-secondary">{onAvatarClick ? "点击头像选择图片" : showImage ? "人物头像" : "尚未配置人物头像"}</p>
  </section>;
}
