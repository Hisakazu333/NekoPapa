/**
 * What a key press in a chat input does under the General "发送消息" setting.
 * IME composition never sends. "newline" means: let the textarea insert it.
 */
export type SendKeyMode = "enter" | "mod-enter";
export type SendKeyAction = "send" | "newline";

export interface SendKeyEvent {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  isComposing: boolean;
  keyCode?: number;
}

export const normalizeSendKeyMode = (value: unknown): SendKeyMode => value === "mod-enter" ? "mod-enter" : "enter";

export function sendKeyAction(event: SendKeyEvent, mode: SendKeyMode): SendKeyAction | undefined {
  if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return undefined;
  const modifier = event.metaKey || event.ctrlKey;
  if (mode === "mod-enter") return modifier && !event.shiftKey && !event.altKey ? "send" : "newline";
  // Enter mode keeps the earlier behaviour: only Shift + Enter inserts a newline.
  return event.shiftKey ? "newline" : "send";
}
