import { useState } from "react";
import { ChevronRightIcon, RotateCcwIcon, ZapIcon } from "@/components/foundations/icons/app-icons";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import { cx } from "@/utils/cx";
import { ReasoningEffortSlider } from "./reasoning-effort-slider";

const ICON_BUTTON = "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-icon-secondary outline-none hover:bg-background-tertiary-default hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring";

/**
 * The model menu's reasoning panel: the level name large in the middle with
 * the model's name under it (choosing it opens the model list), the
 * fastest-level button on the left, reset on the right and the pixel
 * slider beneath. The stops are the levels this model documents, faster to
 * smarter. Untouched, the thumb rests on the service's documented default
 * (or the middle when none is documented) and nothing is sent; moving it
 * sets a level for this chat, and reset clears it. A model on a service
 * that is not a known vendor's own API, or one the vendor's table does not
 * list, gets a line saying which instead of the slider.
 */
export function ComposerReasoningControl({ state, onPickModel }: { state: ChatComposerState; onPickModel: () => void }) {
  const [preview, setPreview] = useState<number>();
  const selected = state.selected;
  if (!selected) return null;
  const profile = state.reasoningProfile;
  const levels = profile?.levels ?? [];
  const defaultIndex = profile?.defaultId ? levels.findIndex((level) => level.id === profile.defaultId) : -1;
  const chosen = state.reasoning ? levels.findIndex((level) => level.id === state.reasoning!.id) : -1;
  const index = chosen >= 0 ? chosen : defaultIndex >= 0 ? defaultIndex : Math.floor((levels.length - 1) / 2);
  const at = preview !== undefined && preview < levels.length ? preview : index;
  const off = Boolean(profile) && at === 0 && (levels[0]?.id === "none" || levels[0]?.id === "off");

  return <div className="flex flex-col gap-3 p-1.5">
    <div className="flex items-start gap-1">
      <button type="button" onClick={() => state.setReasoning(levels[0]?.id)} disabled={!profile}
        aria-label={profile ? `切到最快的档位：${levels[0]?.label}` : "没有可选的推理档位"} title={profile ? `最快：${levels[0]?.label}` : undefined}
        className={cx(ICON_BUTTON, "disabled:invisible")}>
        <ZapIcon className="size-4" aria-hidden />
      </button>
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <output aria-live="polite" className={cx("max-w-full truncate text-title-3-semibold transition-colors",
          !profile ? "text-text-secondary" : off ? "text-text-tertiary" : "text-accent-500")}>
          {profile ? levels[at]?.label : "服务默认"}
        </output>
        <button type="button" onClick={onPickModel} aria-label={`更换模型，当前为 ${selected.name}`}
          className="flex max-w-full cursor-pointer items-center gap-0.5 rounded-md px-1.5 text-body-2-regular text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
          <span translate="no" className="truncate">{selected.name}</span>
          <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
        </button>
      </div>
      <button type="button" onClick={() => state.setReasoning(undefined)} disabled={!state.reasoning}
        aria-label="恢复服务默认的推理档位" title="恢复服务默认" className={cx(ICON_BUTTON, "disabled:invisible")}>
        <RotateCcwIcon className="size-4" aria-hidden />
      </button>
    </div>
    {profile
      ? <ReasoningEffortSlider labels={levels.map((level) => level.label)} value={index} label="推理档位"
        firstIsOff={levels[0]?.id === "none" || levels[0]?.id === "off"}
        description={`${levels[index]?.hint ?? ""} ${profile.note}`} onPreview={setPreview}
        onChange={(next) => state.setReasoning(levels[next]?.id)} />
      : <p className="px-2 pb-1 text-center text-caption-1-regular text-text-tertiary">
        {selected.vendor
          ? `${selected.provider} 的文档里没有核对过这个模型的推理档位，按服务默认回复，不发送推理参数。`
          : "这个地址不是已知厂商的官方接口，推理参数以该服务为准；这里不发送推理参数，按服务默认回复。"}
      </p>}
  </div>;
}
