import { useId, useState } from "react";
import { RiAddLine, RiApps2Line, RiCpuLine, RiGoogleLine, RiSearchLine, RiSettings3Line } from "@remixicon/react";
import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { ChevronDownSmall } from "@/components/foundations/icons/chevrons";
import { filterComposerModels, type ComposerModelOption } from "@/app/composer-model";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import { cx } from "@/utils/cx";
import { COMPOSER_MENU_TRIGGER } from "./composer-trigger-styles";

export function ComposerModelMenu({ state, onConfigure, disabled, className, official = false }: {
  state: ChatComposerState;
  onConfigure: (returnFocusTarget?: HTMLElement | null) => void;
  disabled?: boolean;
  className?: string;
  official?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeProvider, setActiveProvider] = useState<string>();
  const inputId = useId();
  const triggerId = useId();
  const matches = filterComposerModels(state.models, query);
  const providers = [...new Set(state.models.map((model) => model.provider))];
  const selectedProvider = providers.includes(activeProvider ?? "")
    ? activeProvider
    : providers.includes(state.selected?.provider ?? "") ? state.selected?.provider : providers[0];
  const visibleModels = query.trim() ? matches : filterComposerModels(state.models, "", selectedProvider);
  const contentHeight = Math.min(276, Math.max(100, 32 + visibleModels.length * 44, providers.length * 34));
  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setSearchOpen(false);
    }
  };
  const choose = (model: ComposerModelOption) => {
    state.selectModel(model.id);
    setActiveProvider(model.provider);
    close(false);
  };
  const configure = () => {
    close(false);
    onConfigure(document.getElementById(triggerId));
  };
  const status = state.modelBlockReason
    || (official ? "官方服务未接入，模型选择不影响调用。" : state.selected?.runtime ? "当前使用运行服务提供的模型。" : "所选模型偏好暂存于本机会话。" );

  return <Dropdown isOpen={open} onOpenChange={close}>
    <DropdownTrigger id={triggerId} aria-label="选择聊天模型" aria-description={status} isDisabled={disabled}
      className={cx(COMPOSER_MENU_TRIGGER, "max-w-[220px] justify-center gap-0.5 rounded-xl bg-background-primary-default py-1.5 pe-1 ps-2 hover:bg-background-primary-hover", className)}>
      <span className="truncate">{state.selected?.name || (state.selectedModelId ? "重新选择模型" : "选择模型")}</span>
      <ChevronDownSmall className="size-4 shrink-0 text-text-tertiary" aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label="选择聊天模型" placement="top end" className="w-[341px]" dialogClassName="max-h-[min(520px,72dvh)] overflow-hidden overscroll-contain">
      <div className="flex max-h-[52dvh] min-h-0 gap-2" style={{ height: contentHeight }}>
        {providers.length > 0 && <div role="group" aria-label="模型供应商" className="flex w-[42px] shrink-0 flex-col items-center gap-1 overflow-y-auto rounded-[17px] bg-composer-panel-rail-background p-[3px]">
          {providers.map((provider) => <button key={provider} type="button" aria-label={provider} title={provider} aria-pressed={!query.trim() && selectedProvider === provider} onClick={() => {
            setActiveProvider(provider);
            if (query) { setQuery(""); setSearchOpen(false); }
          }} className={cx("flex h-[30px] w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-foreground-icon-secondary outline-none hover:bg-dropdown-item-hover-background focus-visible:ring-2 focus-visible:ring-border-focus-ring", !query.trim() && selectedProvider === provider && "bg-background-primary-default text-foreground-icon-primary shadow-xs")}>
            <ProviderIcon provider={provider} className="size-5" />
          </button>)}
        </div>}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-8 items-center justify-between gap-2 px-1">
            {!searchOpen && <h2 className="text-body-medium text-text-primary">模型</h2>}
            {searchOpen ? <label htmlFor={inputId} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-background-secondary-default px-2 py-1.5">
              <RiSearchLine className="size-4 shrink-0 text-text-tertiary" aria-hidden />
              <input id={inputId} autoFocus aria-label="搜索模型" placeholder="搜索名称或供应商" value={query}
                onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-caption-1-regular text-text-primary outline-none placeholder:text-text-tertiary" />
            </label> : <button type="button" aria-label="快速搜索模型" title="快速搜索模型" onClick={() => setSearchOpen(true)}
              className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 text-caption-1-regular text-text-secondary outline-none hover:bg-background-tertiary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring">
              <span>快速搜索</span>
              <RiSearchLine className="size-4" aria-hidden />
            </button>}
          </div>
          <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {visibleModels.length ? visibleModels.map((option) => <DropdownItem key={option.id} selected={state.selectedModelId === option.id}
              onSelect={() => choose(option)} className="min-h-10 min-w-0 gap-2.5">
              <ProviderIcon provider={option.provider} className="size-[18px] shrink-0 text-foreground-icon-secondary" />
              <span className="min-w-0 flex-1 truncate text-body-medium" title={`${option.name} · ${option.model}`}>{option.name}</span>
              <span aria-hidden className={cx("flex size-4 shrink-0 items-center justify-center rounded-full border", state.selectedModelId === option.id ? "border-text-primary text-text-primary" : "border-border-button-default")}>
                {state.selectedModelId === option.id && <span className="size-2 rounded-full bg-current" />}
              </span>
            </DropdownItem>) : <div role="status" className="px-2 py-5 text-center text-caption-1-regular text-text-tertiary">
              {state.models.length ? "没有匹配的模型。" : "还没有已配置的模型。"}
              {!state.models.length && <button type="button" onClick={configure}
                className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-text-primary outline-none hover:bg-background-tertiary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring">
                <RiAddLine className="size-4" aria-hidden />添加模型
              </button>}
            </div>}
          </div>
        </div>
      </div>
      <DropdownDivider />
      <DropdownItem onSelect={configure}>
        <RiSettings3Line className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
        <span>管理模型</span>
      </DropdownItem>
    </DropdownPopover>
  </Dropdown>;
}

function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  const name = provider.toLocaleLowerCase();
  const asset = name.includes("anthropic") ? "anthropic"
    : name.includes("deepseek") ? "deepseek"
      : name.includes("openai") || name.includes("兼容") ? "openai" : undefined;
  if (asset) {
    const url = `url("/boardui/composer-panel/models/${asset}.svg")`;
    return <span aria-hidden className={cx("inline-block bg-current", className)} style={{ maskImage: url, WebkitMaskImage: url, maskRepeat: "no-repeat", maskPosition: "center", maskSize: "contain" }} />;
  }
  const Icon = name.includes("google") || name.includes("gemini") ? RiGoogleLine
    : name.includes("其他") || name.includes("custom") ? RiApps2Line : RiCpuLine;
  return <Icon className={className} aria-hidden />;
}
