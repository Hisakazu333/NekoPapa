import { useId, useState } from "react";
import { CheckIcon, ChevronLeftIcon, CpuIcon, LayoutGridIcon, PlusIcon, SearchIcon, SettingsIcon, SparkleIcon } from "@/components/foundations/icons/app-icons";
import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { ChevronDownSmall } from "@/components/foundations/icons/chevrons";
import { filterComposerModels, type ComposerModelOption } from "@/app/models/composer-model";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import { cx } from "@/utils/cx";
import { COMPOSER_MENU_TRIGGER } from "./composer-trigger-styles";
import { ComposerReasoningControl } from "./composer-reasoning-control";

/**
 * The composer's model menu. Opened with a model chosen, it shows the
 * reasoning panel (level, model name, pixel slider); the model name opens
 * the model list in the same popover: a search field and the configured
 * models grouped by provider, the chosen one checked. Choosing a model
 * returns to its reasoning panel. With no model chosen it opens on the list.
 */
export function ComposerModelMenu({ state, onConfigure, disabled, className }: {
  state: ChatComposerState;
  onConfigure: (returnFocusTarget?: HTMLElement | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"reasoning" | "models">("reasoning");
  const [query, setQuery] = useState("");
  const inputId = useId();
  const triggerId = useId();
  const matches = filterComposerModels(state.models, query);
  // Groups keep the order the models come in (the running service first).
  const groups = [...new Set(matches.map((model) => model.provider))].map((provider) => ({ provider, models: matches.filter((model) => model.provider === provider) }));
  const showList = view === "models" || !state.selected;
  const close = (next: boolean) => {
    setOpen(next);
    if (next) setView("reasoning");
    else setQuery("");
  };
  const choose = (model: ComposerModelOption) => {
    if (model.id !== state.selectedModelId) state.selectModel(model.id);
    setQuery("");
    setView("reasoning");
  };
  const configure = () => {
    close(false);
    onConfigure(document.getElementById(triggerId));
  };
  // The trigger names the level once it is not the service's default.
  const reasoningLabel = state.reasoning?.label;
  const status = state.modelBlockReason
    || (state.selected?.runtime ? "当前使用运行服务提供的模型。" : state.selected ? "使用你在 设置 → 模型与 API 保存的配置回复。" : "未选择模型。" );

  return <Dropdown isOpen={open} onOpenChange={close}>
    <DropdownTrigger id={triggerId} aria-label="选择聊天模型" aria-description={status} isDisabled={disabled}
      className={cx(COMPOSER_MENU_TRIGGER, "max-w-[220px] justify-center gap-0.5 rounded-xl bg-background-primary-default py-1.5 pe-1 ps-2 hover:bg-background-primary-hover", className)}>
      <span className="truncate">{state.selected?.name || (state.modelBlockReason ? "重新选择模型" : "选择模型")}</span>
      {state.selected && reasoningLabel && <span className="shrink-0 text-text-tertiary">· {reasoningLabel}</span>}
      <ChevronDownSmall className="size-4 shrink-0 text-text-tertiary" aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label={showList ? "选择聊天模型" : "推理档位"} placement="top end" className="w-[340px]" dialogClassName="overflow-hidden overscroll-contain">
      {!showList ? <ComposerReasoningControl state={state} onPickModel={() => setView("models")} /> : <>
        <div className="flex items-center gap-1">
          {state.selected && <button type="button" aria-label="返回推理档位" onClick={() => { setQuery(""); setView("reasoning"); }}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-icon-secondary outline-none hover:bg-background-tertiary-default hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
            <ChevronLeftIcon className="size-4" aria-hidden />
          </button>}
          <label htmlFor={inputId} className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1.5">
            <SearchIcon className="size-4 shrink-0 text-text-tertiary" aria-hidden />
            <input id={inputId} autoFocus aria-label="搜索模型" placeholder="搜索模型…" value={query} disabled={!state.models.length}
              onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-body-2-regular text-text-primary outline-none placeholder:text-text-tertiary" />
          </label>
        </div>
        <div className="mt-1 flex max-h-[clamp(160px,calc(100dvh-420px),360px)] min-h-0 flex-col overflow-y-auto">
          {groups.length ? groups.map(({ provider, models }) => <section key={provider} aria-label={provider} className="flex flex-col pb-1">
            <h3 className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-caption-1-medium text-text-tertiary">
              <ProviderIcon provider={provider} vendor={models[0]?.vendor} className="size-3.5 shrink-0" />
              <span className="truncate">{provider}</span>
            </h3>
            {models.map((option) => {
              const selected = state.selectedModelId === option.id;
              return <DropdownItem key={option.id} selected={selected} onSelect={() => choose(option)} className="min-h-9 min-w-0 gap-2 py-1.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span translate="no" className="truncate text-body-2-regular text-text-primary">{option.name}</span>
                  {(option.runtime || option.name !== option.model) && <span translate="no" className="truncate text-caption-1-regular text-text-tertiary">{option.runtime ? `${option.model} · 运行服务` : option.model}</span>}
                </span>
                {selected && <CheckIcon className="size-4 shrink-0 text-text-secondary" aria-hidden />}
              </DropdownItem>;
            })}
          </section>) : <div role="status" className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
            <p className="text-body-medium text-text-primary">{query.trim() ? "没有匹配的模型" : "还没有可选的模型"}</p>
            <p className="text-body-2-regular text-text-secondary">{query.trim() ? "换个名称、模型 ID 或供应商试试。" : "在“模型与 API”中填写接口地址、密钥和模型名称后，就能在这里选择。"}</p>
          </div>}
        </div>
        <DropdownDivider />
        <div className="flex items-center justify-between gap-2 ps-2">
          <p className="min-w-0 truncate text-caption-1-regular text-text-tertiary" title={status}>{status}</p>
          <DropdownItem onSelect={configure} className="w-auto shrink-0 gap-1.5 px-2 py-1.5">
            {state.models.length ? <SettingsIcon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden /> : <PlusIcon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />}
            <span className="text-body-2-medium">{state.models.length ? "管理模型" : "添加模型"}</span>
          </DropdownItem>
        </div>
      </>}
    </DropdownPopover>
  </Dropdown>;
}

const LOGOS = new Set(["openai", "anthropic", "deepseek"]);

/**
 * A vendor's mark: the three logo assets the composer panel ships, else the
 * vendor's initial on a tile (no other brand marks are bundled), else an
 * icon for the interface type.
 */
function ProviderIcon({ provider, vendor, className }: { provider: string; vendor?: string; className?: string }) {
  const name = provider.toLocaleLowerCase();
  const asset = vendor && LOGOS.has(vendor) ? vendor
    : !vendor && name.includes("anthropic") ? "anthropic"
      : !vendor && (name.includes("openai") || name.includes("兼容")) ? "openai" : undefined;
  if (asset) {
    const url = `url("/boardui/composer-panel/models/${asset}.svg")`;
    return <span aria-hidden className={cx("inline-block bg-current", className)} style={{ maskImage: url, WebkitMaskImage: url, maskRepeat: "no-repeat", maskPosition: "center", maskSize: "contain" }} />;
  }
  if (vendor) return <span aria-hidden className={cx("inline-flex items-center justify-center rounded-md bg-background-tertiary-default text-caption-2-semibold text-text-secondary", className)}>
    {Array.from(provider.replace(/^[^\p{L}\p{N}]+/u, ""))[0]}
  </span>;
  const Icon = name.includes("google") || name.includes("gemini") ? SparkleIcon
    : name.includes("其他") || name.includes("custom") ? LayoutGridIcon : CpuIcon;
  return <Icon className={className} aria-hidden />;
}
