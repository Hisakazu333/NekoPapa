import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { Textarea } from "@/components/base/textarea/textarea";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { useSettingsDraft } from "../settings-draft-context";

/**
 * Edits the local profile in place of the profile overview. Cancel and save
 * both return to the overview; closing settings with unsaved edits goes
 * through the shared settings draft guard.
 */
export function ProfileEditForm({ onDone }: { onDone: () => void }) {
  const { profile, saveProfile, storageAvailable, notice } = useLocalProfile();
  const formId = useId();
  // The draft belongs to this form. External updates can refresh the menu
  // without replacing edits until this instance is saved or dismissed.
  const [original, setOriginal] = useState(profile);
  const [draft, setDraft] = useState(original);
  const clearDraft = useSettingsDraft("profile", JSON.stringify(draft) !== JSON.stringify(original));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = (key: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "", form: "" }));
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    const result = saveProfile(draft, original);
    if (result) setErrors(result);
    else { setOriginal(draft); clearDraft(); onDone(); }
  };

  return (
    <>
      <ModalBody>
        <form id={formId} onSubmit={save} noValidate aria-label="编辑本机资料" className="flex flex-col gap-4">
          <p className="text-body-regular text-text-secondary">名称、介绍和网站只保存在此设备。登录 NekoPapa 账号后，账号名称和头像会优先显示。</p>
          <Input
            label="显示名称"
            value={draft.name}
            onChange={(value) => update("name", value)}
            maxLength={60}
            isRequired
            autoFocus
            validationBehavior="aria"
            isInvalid={Boolean(errors.name)}
            errorMessage={errors.name}
          />
          <Textarea
            label="关于你"
            value={draft.biography}
            onChange={(value) => update("biography", value)}
            maxLength={1000}
            showCount
            rows={4}
            isInvalid={Boolean(errors.biography)}
            hint={errors.biography || "可选，显示在个人资料中。"}
          />
          <Input
            label="个人网站"
            value={draft.website}
            onChange={(value) => update("website", value)}
            maxLength={500}
            type="url"
            validationBehavior="aria"
            isInvalid={Boolean(errors.website)}
            errorMessage={errors.website}
            hint="可选，填写完整的 HTTP 或 HTTPS 地址。"
          />
          {(errors.form || (!storageAvailable && notice)) && (
            <p role="alert" className="text-body-regular text-text-error-primary">
              {errors.form || notice}
            </p>
          )}
        </form>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={() => { setDraft(original); clearDraft(); onDone(); }}>取消</Button>
        <Button type="submit" form={formId}>
          {storageAvailable ? "保存" : "重试保存"}
        </Button>
      </ModalFooter>
    </>
  );
}
