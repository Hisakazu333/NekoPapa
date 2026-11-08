import type { ChatComposerState } from "@/hooks/use-chat-composer";
import type { ComposerContext } from "@/app/chat-composer-draft";
import { ContactComposer } from "../contacts/contact-composer";

/** Workbench and contacts share the same composer controls and draft contract. */
export function AgentComposer({ value, onValueChange, onSubmit, onStop, onConfigure, busy, disabled, sendBlockedReason, composer, name, officialCompanion, context }: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onConfigure: (returnFocusTarget?: HTMLElement | null) => void;
  busy: boolean;
  disabled?: boolean;
  sendBlockedReason?: string;
  composer: ChatComposerState;
  name: string;
  officialCompanion?: boolean;
  context: ComposerContext;
}) {
  return <ContactComposer name={name} value={value} onChange={onValueChange} onSend={onSubmit} onStop={onStop}
    onConfigure={onConfigure} busy={busy} ready={!disabled} sendBlockedReason={sendBlockedReason}
    composer={composer} officialCompanion={officialCompanion} context={context} />;
}
