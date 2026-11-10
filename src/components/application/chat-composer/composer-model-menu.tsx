import { useId, useState } from "react";
import { CpuIcon, LayoutGridIcon, PlusIcon, SearchIcon, SettingsIcon, SparkleIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { ChevronDownSmall } from "@/components/foundations/icons/chevrons";
import { composerProviderTypes, filterComposerModels, type ComposerModelOption } from "@/app/composer-model";
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
  // The rail always lists every provider type a profile can use, plus any the running service reports,
  // so an unconfigured provider is a place to add a model rather than a missing icon.
  const providers = [...new Set([...state.models.filter((model) => model.runtime).map((model) => model.provider), ...composerProviderTypes, ...state.models.map((model) => model.provider)])];
  const firstConfigured = state.models[0]?.provider;
  const selectedProvider = providers.includes(activeProvider ?? "")
    ? activeProvider!
    : providers.includes(state.selected?.provider ?? "") ? state.selected!.provider : firstConfigured ?? providers[0];
  const searching = Boolean(query.trim());
  const visibleModels = searching ? matches : filterComposerModels(state.models, "", selectedProvider);
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
    || (official ? "官方服务未接入，模型选择不影响调用。" : state.selected?.runtime ? "当前使用运行服务提供的模型。" : state.selected ? "使用你在 设置 → 模型与 API 保存的配置回复。" : "未选择模型。" );

  return <Dropdown isOpen={open} onOpenChange={close}>
    <DropdownTrigger id={triggerId} aria-label="选择聊天模型" aria-description={status} isDisabled={disabled}
      className={cx(COMPOSER_MENU_TRIGGER, "max-w-[220px] justify-center gap-0.5 rounded-xl bg-background-primary-default py-1.5 pe-1 ps-2 hover:bg-background-primary-hover", className)}>
      <span className="truncate">{state.selected?.name || (state.selectedModelId ? "重新选择模型" : "选择模型")}</span>
      <ChevronDownSmall className="size-4 shrink-0 text-text-tertiary" aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label="选择聊天模型" placement="top end" className="w-[360px]" dialogClassName="overflow-hidden overscroll-contain">
      <div className="flex h-[min(300px,52dvh)] min-h-0 gap-2">
        <div role="group" aria-label="模型供应商" className="flex w-[42px] shrink-0 flex-col items-center gap-1 overflow-y-auto rounded-[17px] bg-composer-panel-rail-background p-[3px]">
          {providers.map((provider) => {
            const active = !searching && selectedProvider === provider;
            const count = state.models.filter((model) => model.provider === provider).length;
            return <button key={provider} type="button" aria-label={`${provider}（${count ? `${count} 个模型` : "未配置"}）`} title={provider} aria-pressed={active} onClick={() => {
              setActiveProvider(provider);
              if (query) { setQuery(""); setSearchOpen(false); }
            }} className={cx("relative flex h-[30px] w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl outline-none hover:bg-dropdown-item-hover-background focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              active ? "bg-background-primary-default text-foreground-icon-primary shadow-xs" : count ? "text-foreground-icon-secondary" : "text-foreground-icon-secondary opacity-50")}>
              <ProviderIcon provider={provider} className="size-5" />
            </button>;
          })}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-8 items-center justify-between gap-2 ps-1">
            {searchOpen ? <label htmlFor={inputId} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-background-secondary-default px-2 py-1.5">
              <SearchIcon className="size-4 shrink-0 text-text-tertiary" aria-hidden />
              <input id={inputId} autoFocus aria-label="搜索模型" placeholder="搜索名称、模型或供应商" value={query}
                onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-body-2-regular text-text-primary outline-none placeholder:text-text-tertiary" />
              <button type="button" aria-label="关闭搜索" onClick={() => { setQuery(""); setSearchOpen(false); }}
                className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-tertiary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
                <XIcon className="size-4" aria-hidden />
              </button>
            </label> : <>
              <h2 className="truncate text-body-medium text-text-primary">{selectedProvider}</h2>
              <button type="button" aria-label="搜索模型" title="搜索模型" disabled={!state.models.length} onClick={() => setSearchOpen(true)}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary outline-none hover:bg-background-tertiary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-40">
                <SearchIcon className="size-4" aria-hidden />
              </button>
            </>}
          </div>
          <div className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
            {visibleModels.length ? visibleModels.map((option) => {
              const selected = state.selectedModelId === option.id;
              return <DropdownItem key={option.id} selected={selected} onSelect={() => choose(option)} className="min-h-11 min-w-0 gap-2.5 py-1.5">
                <ProviderIcon provider={option.provider} className="size-[18px] shrink-0 text-foreground-icon-secondary" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-medium text-text-primary">{option.name}</span>
                  <span translate="no" className="truncate text-caption-1-regular text-text-tertiary">{option.runtime ? `${option.model} · 运行服务` : searching ? `${option.model} · ${option.provider}` : option.model}</span>
                </span>
                <span aria-hidden className={cx("flex size-4 shrink-0 items-center justify-center rounded-full border", selected ? "border-accent-500 text-accent-500" : "border-border-button-default")}>
                  {selected && <span className="size-2 rounded-full bg-current" />}
                </span>
              </DropdownItem>;
            }) : <div role="status" className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
              <ProviderIcon provider={selectedProvider} className="size-7 text-foreground-icon-secondary" />
              <p className="text-body-medium text-text-primary">{searching ? "没有匹配的模型" : `还没有 ${selectedProvider} 模型`}</p>
              <p className="text-body-2-regular text-text-secondary">{searching ? "换个名称、模型 ID 或供应商试试。" : "在“模型与 API”中填写接口地址、密钥和模型名称后，就能在这里选择。"}</p>
              {!searching && <button type="button" onClick={configure}
                className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-lg bg-background-tertiary-default px-2.5 py-1.5 text-body-2-medium text-text-primary outline-none hover:bg-background-quaternary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring">
                <PlusIcon className="size-4" aria-hidden />添加模型
              </button>}
            </div>}
          </div>
        </div>
      </div>
      <DropdownDivider />
      <div className="flex items-center justify-between gap-2 ps-2">
        <p className="min-w-0 truncate text-caption-1-regular text-text-tertiary" title={status}>{status}</p>
        <DropdownItem onSelect={configure} className="w-auto shrink-0 gap-1.5 px-2 py-1.5">
          <SettingsIcon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-2-medium">管理模型</span>
        </DropdownItem>
      </div>
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
  const Icon = name.includes("google") || name.includes("gemini") ? SparkleIcon
    : name.includes("其他") || name.includes("custom") ? LayoutGridIcon : CpuIcon;
  return <Icon className={className} aria-hidden />;
}
