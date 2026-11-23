/**
 * Legal documents shown in the desktop app. The text lives in its own files
 * (desktop-user-agreement.ts, desktop-privacy-policy.ts); this module owns
 * the shape and the version a sign-in consent refers to.
 */
export type LegalBlock = Readonly<{ type: "paragraph" | "bullet"; text: string }>;

export type LegalSection = Readonly<{ title: string; blocks: readonly LegalBlock[] }>;

export type LegalDocumentKind = "user-agreement" | "privacy-policy";

export type LegalDocument = Readonly<{
  kind: LegalDocumentKind;
  title: string;
  summary: string;
  /** Shown under the title. Drafts say so until they are reviewed and published. */
  revisionLabel: string;
  /** False until legal review approves the text; the page then marks it as a draft. */
  published: boolean;
  sections: readonly LegalSection[];
}>;

export const paragraph = (text: string): LegalBlock => Object.freeze({ type: "paragraph", text });
export const bullet = (text: string): LegalBlock => Object.freeze({ type: "bullet", text });
export const section = (title: string, ...blocks: LegalBlock[]): LegalSection =>
  Object.freeze({ title, blocks: Object.freeze(blocks) });
