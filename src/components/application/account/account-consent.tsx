import { useState } from "react";
import { DESKTOP_PRIVACY_POLICY } from "@/app/legal/desktop-privacy-policy";
import { DESKTOP_USER_AGREEMENT } from "@/app/legal/desktop-user-agreement";
import type { LegalDocument, LegalDocumentKind } from "@/app/legal/legal-document";
import { Badge } from "@/components/base/badges/badge";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { cx } from "@/utils/cx";

const DOCUMENTS: Record<LegalDocumentKind, LegalDocument> = {
  "user-agreement": DESKTOP_USER_AGREEMENT,
  "privacy-policy": DESKTOP_PRIVACY_POLICY,
};

/** Reads one legal document in full, with its revision and draft status. */
export function LegalDocumentModal({ kind, onClose }: { kind?: LegalDocumentKind; onClose: () => void }) {
  const document = kind ? DOCUMENTS[kind] : undefined;
  return <Modal size="lg" isOpen={Boolean(document)} onOpenChange={(open) => { if (!open) onClose(); }}>
    {document && <>
      <ModalHeader title={document.title} description={<span className="flex flex-wrap items-center gap-2">
        <span>{document.revisionLabel}</span>
        {!document.published && <Badge>草案</Badge>}
      </span>} />
      <ModalBody className="max-h-[60vh] pb-4">
        <p className="mb-5 text-body-regular text-text-secondary">{document.summary}</p>
        {document.sections.map((part) => <section key={part.title} className="mb-5 flex flex-col gap-2">
          <h3 className="text-headline-semibold text-text-primary">{part.title}</h3>
          {part.blocks.map((block) => block.type === "bullet"
            ? <p key={block.text} className="relative ps-4 text-body-regular text-text-secondary before:absolute before:start-1 before:top-[0.6em] before:size-1 before:rounded-full before:bg-foreground-icon-tertiary">{block.text}</p>
            : <p key={block.text} className="text-body-regular text-text-secondary">{block.text}</p>)}
        </section>)}
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>我知道了</Button>
      </ModalFooter>
    </>}
  </Modal>;
}

/**
 * The sign-in consent. The links sit beside the checkbox, not inside its
 * label, so opening a document never toggles the agreement.
 */
export function AccountConsent({ accepted, onChange, invalid, isDisabled }: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  invalid?: boolean;
  isDisabled?: boolean;
}) {
  const [reading, setReading] = useState<LegalDocumentKind>();
  const link = (kind: LegalDocumentKind, label: string) =>
    <button type="button" onClick={() => setReading(kind)}
      className="cursor-pointer rounded-sm text-text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring">
      {label}
    </button>;

  return <div className="flex items-start gap-2">
    <Checkbox size="sm" isSelected={accepted} onChange={onChange} isDisabled={isDisabled} isInvalid={invalid}
      aria-label="我已阅读并同意《用户协议》和《隐私政策》" className="mt-0.5" />
    <p className={cx("text-caption-1-regular", invalid ? "text-text-error-primary" : "text-text-secondary")}>
      我已阅读并同意 {link("user-agreement", "《用户协议》")} 和 {link("privacy-policy", "《隐私政策》")}，未注册的手机号验证后将自动创建账号。
    </p>
    <LegalDocumentModal kind={reading} onClose={() => setReading(undefined)} />
  </div>;
}
