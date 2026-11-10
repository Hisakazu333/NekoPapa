import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { ImagePlusIcon } from "@/components/foundations/icons/app-icons";
import type { ChatContact } from "@/app/contacts-store";
import { Button } from "@/components/base/buttons/button";
import { AgentAppearancePreview } from "./agent-appearance-preview";
import { CONTACT_AVATAR_ACCEPT, importContactAvatar } from "./contact-avatar-import";

interface ContactAvatarEditorProps {
  contact: ChatContact;
  value?: string;
  error?: string;
  onChange: (value: string | undefined) => void;
  onBusyChange: (busy: boolean) => void;
}

export function ContactAvatarEditor({ contact, value, error, onChange, onBusyChange }: ContactAvatarEditorProps) {
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef<AbortController | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const feedbackId = useId();
  useEffect(() => () => pending.current?.abort(), []);

  const selectFile = () => input.current?.click();
  const changeFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    pending.current?.abort();
    const operation = new AbortController();
    pending.current = operation;
    setBusy(true);
    onBusyChange(true);
    setImportError("");
    try {
      const dataUrl = await importContactAvatar(file, operation.signal);
      if (!operation.signal.aborted) onChange(dataUrl);
    } catch (failure) {
      if (!operation.signal.aborted) setImportError(failure instanceof Error ? failure.message : "无法导入图片，请重试。");
    } finally {
      if (!operation.signal.aborted) {
        pending.current = undefined;
        setBusy(false);
        onBusyChange(false);
      }
    }
  };

  return <div className="flex shrink-0 flex-col gap-3">
    <AgentAppearancePreview contact={contact} onAvatarClick={selectFile} avatarImporting={busy} />
    <input ref={input} type="file" accept={CONTACT_AVATAR_ACCEPT} aria-label="选择联系人头像图片" className="hidden" onChange={(event) => void changeFile(event)} />
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button ref={trigger} variant="secondary" size="small" leadingIcon={ImagePlusIcon} onClick={selectFile} disabled={busy}
        aria-invalid={Boolean(importError || error) || undefined} aria-describedby={feedbackId}>
        {busy ? "正在处理图片…" : value ? "更换头像" : "导入头像"}
      </Button>
      {value && <Button variant="ghost" size="small" disabled={busy} onClick={() => {
        setImportError("");
        onChange(undefined);
        trigger.current?.focus();
      }}>移除头像</Button>}
    </div>
    <p id={feedbackId} role={importError || error ? "alert" : undefined} className={`text-center text-caption-1-regular ${importError || error ? "text-text-error-primary" : "text-text-secondary"}`}>
      {importError || error || "PNG / JPG / WebP · 最大 5 MB · 自动居中裁剪"}
    </p>
  </div>;
}
