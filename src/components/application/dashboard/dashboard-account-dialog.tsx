import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { Textarea } from "@/components/base/textarea/textarea";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { useSettingsDraft } from "../settings/settings-draft-context";

export function ProfileSettingsPanel({ onClose }: { onClose: () => void }) {
  const { profile, saveProfile, storageAvailable, notice } = useLocalProfile();
  const formId = useId();
  // The draft belongs to this dialog. External updates can refresh the menu
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
    else { setOriginal(draft); clearDraft(); onClose(); }
  };

  return (
    <>
      <ModalBody>
        <form id={formId} onSubmit={save} noValidate className="flex flex-col gap-4">
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
            hint={errors.biography || "可选，仅保存在本机。"}
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
        <Button variant="secondary" onClick={() => { setDraft(original); clearDraft(); onClose(); }}>取消</Button>
        <Button type="submit" form={formId}>
          {storageAvailable ? "保存" : "重试保存"}
        </Button>
      </ModalFooter>
    </>
  );
}
