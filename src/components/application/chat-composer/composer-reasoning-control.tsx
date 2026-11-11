import { RotateCcwIcon } from "@/components/foundations/icons/app-icons";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import { ReasoningEffortSlider } from "./reasoning-effort-slider";

/**
 * 推理档位 for the selected model, at the foot of the model picker, on
 * NekoBuddy's own effort slider. The stops are the levels this model
 * documents, faster to smarter. Untouched, the thumb rests on the service's
 * documented default (or the middle when none is documented) and nothing is
 * sent; moving it sets a level for this chat, and the reset button clears it.
 * A model the capability table does not know gets a line saying so.
 */
export function ComposerReasoningControl({ state }: { state: ChatComposerState }) {
  const selected = state.selected;
  if (!selected) return null;
  const profile = state.reasoningProfile;
  if (!profile) return <div className="px-1 pt-2">
    <p className="text-caption-1-medium text-text-secondary">推理档位</p>
    <p className="text-caption-1-regular text-text-tertiary"><span translate="no">{selected.model}</span> 没有已知的推理档位，按服务默认回复，不发送推理参数。</p>
  </div>;

  const { levels } = profile;
  const defaultIndex = profile.defaultId ? levels.findIndex((level) => level.id === profile.defaultId) : -1;
  const chosen = state.reasoning ? levels.findIndex((level) => level.id === state.reasoning!.id) : -1;
  const index = chosen >= 0 ? chosen : defaultIndex >= 0 ? defaultIndex : Math.floor((levels.length - 1) / 2);
  const current = levels[index];

  return <div className="flex flex-col gap-2 px-1 pt-2">
    <div className="flex items-center justify-between gap-2">
      <p className="min-w-0 truncate text-caption-1-medium text-text-secondary">
        推理档位 · <span translate="no">{selected.model}</span>
      </p>
      {state.reasoning
        ? <button type="button" onClick={() => state.setReasoning(undefined)} aria-label="恢复服务默认的推理档位" title="恢复默认"
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-secondary outline-none hover:bg-background-tertiary-default hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
          <RotateCcwIcon className="size-3.5" aria-hidden />
        </button>
        : <span className="shrink-0 text-caption-1-regular text-text-tertiary">服务默认</span>}
    </div>
    <ReasoningEffortSlider labels={levels.map((level) => level.label)} value={index} label="推理档位"
      firstIsOff={levels[0]?.id === "none" || levels[0]?.id === "off"}
      onChange={(next) => state.setReasoning(levels[next]?.id)} />
    <p role="status" className="text-center text-caption-1-regular text-text-tertiary">{current.hint} {profile.note}</p>
  </div>;
}
