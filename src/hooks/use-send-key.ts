import { useCallback, type KeyboardEvent } from "react";
import { normalizeSendKeyMode, sendKeyAction } from "@/app/send-key";
import { useConfiguration } from "@/hooks/use-configuration";

/**
 * Key handling for chat inputs, following the General "发送消息" setting.
 * `composing` covers IMEs that finish composition before keydown reports it.
 * Returns true when the press was consumed as a send.
 */
export function useSendKey(composing: { current: boolean }) {
  const { data } = useConfiguration();
  const mode = normalizeSendKeyMode(data.groups.general.sendKey);
  return useCallback((event: KeyboardEvent<HTMLTextAreaElement>, send: () => void) => {
    const action = sendKeyAction({ ...event, isComposing: event.nativeEvent.isComposing || composing.current }, mode);
    if (action !== "send") return false;
    event.preventDefault();
    send();
    return true;
  }, [composing, mode]);
}
