import { useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseDesktopAccountProfile } from "@/app/account/desktop-account-contract";
import { CameraIcon } from "@/components/foundations/icons/app-icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { CONTACT_AVATAR_ACCEPT, importContactAvatar } from "../contacts/contact-avatar-import";
import { useAccountSession } from "./account-session";

export function AccountAvatarEditor({ userId, initiallyOpen, children }: { userId: number; initiallyOpen?: boolean; children: ReactNode }) {
  const { setProfile } = useAccountSession();
  const [open, setOpen] = useState(initiallyOpen ?? false);
  const [pending, setPending] = useState<"preparing" | "uploading">();
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const selection = useRef<AbortController>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => () => selection.current?.abort(), []);

  const close = () => {
    selection.current?.abort();
    setOpen(false);
    setPreview("");
    setError("");
    setPending(undefined);
    requestAnimationFrame(() => trigger.current?.focus());
  };

  const prepare = async (file: File) => {
    selection.current?.abort();
    const abort = new AbortController();
    selection.current = abort;
    setError("");
    setPending("preparing");
    try {
      const image = await importContactAvatar(file, abort.signal);
      if (!abort.signal.aborted) setPreview(image);
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "无法处理图片。");
    } finally {
      if (!abort.signal.aborted) setPending(undefined);
    }
  };

  const save = async () => {
    if (!preview || pending) return;
    setPending("uploading");
    setError("");
    try {
      const bytes = Array.from(atob(preview.slice(preview.indexOf(",") + 1)), (byte) => byte.charCodeAt(0));
      const profile = parseDesktopAccountProfile(await invoke("account_avatar_upload", { userId, bytes }));
      setProfile((active) => active?.userId === profile.userId ? profile : active);
      close();
    } catch (failure) {
      setError(typeof failure === "string" ? failure : "头像上传未完成，请重试。");
      setPending(undefined);
      const snapshot = await invoke<{ profile?: unknown }>("account_snapshot").catch(() => null);
      if (snapshot && !snapshot.profile) setProfile((active) => active?.userId === userId ? undefined : active);
    }
  };

  return <>
    <Button ref={trigger} variant="ghost" onClick={() => setOpen(true)} aria-label="更换头像"
      className="group relative h-auto overflow-visible rounded-3xl bg-transparent p-0 hover:bg-transparent active:bg-transparent">
      {children}
      <span className="absolute -bottom-1 -end-1 grid size-7 place-items-center rounded-full border border-border-button-default bg-background-primary-default text-foreground-icon-primary shadow-xs">
        <CameraIcon aria-hidden className="size-3.5" />
      </span>
    </Button>
    <Modal isOpen={open} onOpenChange={(next) => { if (!next && pending !== "uploading") close(); }}
      isDismissable={false} isKeyboardDismissDisabled={pending === "uploading"} size="sm">
      <ModalHeader title="更换账号头像" description="选择 PNG、JPG 或 WebP 图片，保存后同步到账号。" showCloseButton={false} />
      <ModalBody>
        <div className="flex flex-col items-center gap-4">
          {preview && <Avatar src={preview} alt="新头像预览" className="size-24" />}
          <input ref={input} type="file" accept={CONTACT_AVATAR_ACCEPT} hidden onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void prepare(file);
          }} />
          <Button autoFocus variant="secondary" disabled={Boolean(pending)} onClick={() => input.current?.click()}>
            {pending === "preparing" ? "正在处理…" : preview ? "重新选择图片" : "选择图片"}
          </Button>
          {error && <p role="alert" className="text-body-2-regular text-text-error-primary">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={close} disabled={pending === "uploading"}>取消</Button>
        <Button disabled={!preview || Boolean(pending)} onClick={() => void save()}>{pending === "uploading" ? "正在保存…" : "保存头像"}</Button>
      </ModalFooter>
    </Modal>
  </>;
}
