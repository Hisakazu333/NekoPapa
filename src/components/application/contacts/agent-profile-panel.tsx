import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { XIcon } from "@/components/foundations/icons/app-icons";
import { contactAvatarColors, type ChatContact, type ContactAvatarColor, type ContactDraft, type ContactErrors, type ContactLanguage } from "@/app/contacts-store";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Textarea } from "@/components/base/textarea/textarea";
import { Select, SelectItem } from "@/components/base/select/select";
import { useContacts } from "@/hooks/use-contacts";
import { cx } from "@/utils/cx";
import { companionCatalog, type CompanionId } from "@/app/companion-model";
import { AgentAppearancePreview } from "./agent-appearance-preview";
import { ContactAvatarEditor } from "./contact-avatar-editor";

export interface AgentProfilePanelProps {
  contact: ChatContact;
  onClose: () => void;
  onSaved?: (contact: ChatContact) => void;
  creating?: boolean;
  onCreated?: (contact: ChatContact) => void;
}

const colorNames: Record<ContactAvatarColor, string> = { neutral: "灰色", blue: "蓝色", lime: "青柠色", pink: "粉色" };
const colorClasses: Record<ContactAvatarColor, string> = { neutral: "bg-neutral-300", blue: "bg-blue-300", lime: "bg-lime-200", pink: "bg-pink-200" };

/** Changing the selected contact starts its own editor draft; saving keeps its ID. */
export function AgentProfilePanel(props: AgentProfilePanelProps) {
  return <AgentProfileEditor key={props.contact.id} {...props} />;
}

function AgentProfileEditor({ contact, onClose, onSaved, creating = false, onCreated }: AgentProfilePanelProps) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const { updateContact, createContact } = useContacts();
  const official = contact.kind === "official";
  const [draft, setDraft] = useState<ContactDraft>({
    name: contact.name, description: contact.description, prompt: contact.prompt ?? "", tags: contact.tags ?? "",
    language: contact.language ?? "auto", avatarColor: contact.avatarColor ?? "neutral", appearanceId: contact.appearanceId, avatarDataUrl: contact.avatarDataUrl,
  });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [failedSubmission, setFailedSubmission] = useState(0);
  const [saved, setSaved] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  useEffect(() => {
    if (!failedSubmission) return;
    const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? formErrorRef.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center" });
  }, [failedSubmission]);
  const previewAvatar = official ? contact.avatar : draft.avatarDataUrl ?? companionCatalog.find((item) => item.id === draft.appearanceId)?.avatar;
  const previewContact = { ...contact, name: draft.name || "新联系人", avatarColor: draft.avatarColor, appearanceId: draft.appearanceId, avatarDataUrl: draft.avatarDataUrl, avatar: previewAvatar };
  const setField = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
    setSaved(false);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (official || avatarBusy) return;
    const result = creating ? createContact(draft) : updateContact(contact.id, draft);
    if (result.errors) {
      setErrors(result.errors);
      setFailedSubmission((attempt) => attempt + 1);
    }
    else if (result.contact) {
      setDraft(result.contact);
      setSaved(true);
      setErrors({});
      onSaved?.(result.contact);
      if (creating) onCreated?.(result.contact);
    }
  };

  return <aside aria-label={official ? "联系人资料" : "联系人设置"} className="flex h-full min-h-0 min-w-0 flex-col bg-background-full text-text-primary"
    onKeyDown={(event) => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); onClose(); } }}>
    <header className="flex shrink-0 items-center gap-3 px-5 py-4">
      <h2 className="min-w-0 flex-1 truncate text-center text-headline-semibold">{creating ? "创建联系人" : contact.name}</h2>
      <button type="button" aria-label={official ? "关闭联系人资料" : "关闭联系人设置"} onClick={onClose} className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-background-tertiary-default text-text-tertiary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-border-focus-ring"><XIcon className="size-4" aria-hidden /></button>
    </header>
    <form ref={formRef} id={formId} onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-5">
      {official ? <AgentAppearancePreview contact={previewContact} /> : <ContactAvatarEditor contact={previewContact} value={draft.avatarDataUrl}
        error={errors.avatarDataUrl} onChange={(value) => setField("avatarDataUrl", value)} onBusyChange={setAvatarBusy} />}
      {official ? <OfficialContactDetails contact={contact} /> : <>
        <div className="flex shrink-0 flex-col gap-2">
          <Select label="人物外观" selectedKey={draft.appearanceId ?? "none"} onSelectionChange={(key) => setField("appearanceId", key === "none" ? undefined : key as CompanionId)}
            aria-invalid={Boolean(errors.appearanceId) || undefined} aria-describedby={errors.appearanceId ? `${formId}-appearance-error` : undefined} className="w-full">
            <SelectItem id="none">{draft.avatarDataUrl ? "使用导入头像" : "字母头像"}</SelectItem>{companionCatalog.map((item) => <SelectItem key={item.id} id={item.id}>{item.name}</SelectItem>)}
          </Select>
          {errors.appearanceId && <p id={`${formId}-appearance-error`} role="alert" className="text-caption-1-regular text-text-error-primary">{errors.appearanceId}</p>}
        </div>
        {!previewAvatar && <fieldset className="rounded-2xl bg-background-secondary-default p-4">
          <legend className="sr-only">头像颜色</legend>
          <div role="radiogroup" aria-label="头像颜色" className="flex items-center justify-center gap-4">
            {contactAvatarColors.map((color) => <label key={color} className="relative cursor-pointer">
              <input type="radio" name={`${formId}-color`} value={color} checked={draft.avatarColor === color} onChange={() => setField("avatarColor", color)} aria-label={`${colorNames[color]}头像`} className="peer sr-only" />
              <span className={cx("block size-8 rounded-full border border-border-button-default outline-2 outline-offset-3 outline-transparent peer-checked:outline-border-focus-ring peer-focus-visible:outline-border-focus-ring", colorClasses[color])} />
            </label>)}
          </div>
        </fieldset>}
        <div className="flex shrink-0 flex-col gap-4 rounded-2xl bg-background-secondary-default p-4">
          <Input label="姓名" aria-label="联系人名称" value={draft.name} onChange={(value) => setField("name", value)} maxLength={60} isRequired autoFocus={creating} placeholder="为这位联系人命名" validationBehavior="aria" isInvalid={Boolean(errors.name)} errorMessage={errors.name} />
          <Input label="标签" aria-label="联系人标签" value={draft.tags} onChange={(value) => setField("tags", value)} maxLength={100} placeholder="例如：编程、大学课程" isInvalid={Boolean(errors.tags)} errorMessage={errors.tags} />
          <Textarea label="简介" aria-label="联系人简介" value={draft.description} onChange={(value) => setField("description", value)} maxLength={1000} rows={3} showCount isInvalid={Boolean(errors.description)} hint={errors.description || "用于联系人列表和资料识别。"} />
          <Textarea label="专业提示词" aria-label="联系人专业提示词" value={draft.prompt} onChange={(value) => setField("prompt", value)} maxLength={4000} rows={7} showCount isInvalid={Boolean(errors.prompt)} hint={errors.prompt || "定义专长、工作方法和回复格式；此设置不会开放桌面工具或执行权限。"} placeholder="例如：你是资深 Python 导师。先定位问题，再给出渐进提示和可运行示例。" />
        </div>
        <div className="flex shrink-0 flex-col gap-2 rounded-2xl bg-background-secondary-default p-4">
          <Select label="回复语言" selectedKey={draft.language} onSelectionChange={(key) => { if (key) setField("language", key as ContactLanguage); }}
            aria-invalid={Boolean(errors.language) || undefined} aria-describedby={errors.language ? `${formId}-language-error` : undefined} className="w-full">
            <SelectItem id="auto">跟随对话语言</SelectItem><SelectItem id="zh-CN">简体中文</SelectItem><SelectItem id="en">English</SelectItem><SelectItem id="ja">日本語</SelectItem>
          </Select>
          {errors.language && <p id={`${formId}-language-error`} role="alert" className="text-caption-1-regular text-text-error-primary">{errors.language}</p>}
        </div>
      </>}
      {errors.form && <p ref={formErrorRef} role="alert" tabIndex={-1} className="text-body-regular text-text-error-primary outline-none">{errors.form}</p>}
      {saved && <p role="status" className="text-body-regular text-text-secondary">已保存，之后的对话会使用新设定。</p>}
    </form>
    <footer className="flex shrink-0 justify-end gap-2 border-t border-separator-border px-5 py-4">
      <Button variant="secondary" onClick={onClose}>{official ? "关闭" : "取消"}</Button>
      {!official && <Button type="submit" form={formId} disabled={avatarBusy}>{errors.form ? "重试保存" : creating ? "创建联系人" : "保存设定"}</Button>}
    </footer>
  </aside>;
}

function OfficialContactDetails({ contact }: { contact: ChatContact }) {
  return <div className="flex shrink-0 flex-col gap-4 rounded-2xl bg-background-secondary-default p-4">
    <span className="text-caption-1-medium text-text-tertiary">官方同伴 · 固定设定</span>
    <dl className="flex flex-col gap-4 text-body-regular">
      <div><dt className="text-caption-1-regular text-text-tertiary">姓名</dt><dd className="mt-1 text-text-primary">{contact.name}</dd></div>
      <div><dt className="text-caption-1-regular text-text-tertiary">简介</dt><dd className="mt-1 text-text-secondary">{contact.description}</dd></div>
      {contact.tags && <div><dt className="text-caption-1-regular text-text-tertiary">标签</dt><dd className="mt-1 text-text-secondary">{contact.tags}</dd></div>}
      <div><dt className="text-caption-1-regular text-text-tertiary">使用范围</dt><dd className="mt-1 text-text-secondary">单人陪伴聊天、学习</dd></div>
    </dl>
    <p className="text-caption-1-regular text-text-secondary">官方人物使用固定设定，不能修改提示词。学习模式尚未接入。</p>
  </div>;
}
