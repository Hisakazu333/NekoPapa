import { useMemo, useState } from "react";
import { Autocomplete, Button as AriaButton, Header, ListBox, ListBoxItem, ListBoxSection, type Key } from "react-aria-components";
import {
  phoneRegion, phoneRegionMatches, phoneRegionShowsFlag, phoneRegionName, sortedPhoneRegions, type PhoneRegion,
} from "@/app/account/phone-regions";
import { useApplicationLanguage } from "@/components/application/language/application-language";
import { MENU_ITEM, MENU_ITEM_ACTIVE } from "@/components/base/dropdown/menu-styles";
import { Input } from "@/components/base/input/input";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { CheckIcon, GlobeIcon, SearchIcon } from "@/components/foundations/icons/app-icons";
import { ChevronDownSmall } from "@/components/foundations/icons/chevrons";
import { cx } from "@/utils/cx";

/**
 * country-flag-icons 3:2 SVGs. Each flag stays its own asset file (`no-inline`)
 * and loads only when its row is drawn, so the list never bundles 240 images.
 */
const FLAG_URLS = import.meta.glob<string>("/node_modules/country-flag-icons/3x2/*.svg", {
  eager: true, query: "?url&no-inline", import: "default",
});

function flagUrl(id: string) {
  return FLAG_URLS[`/node_modules/country-flag-icons/3x2/${id.toUpperCase()}.svg`];
}

/**
 * The region's flag, 20×14 with a hairline edge so white flags stay visible.
 * Regions without a flag keep the same slot with a neutral globe.
 */
export function PhoneRegionFlag({ id, className }: { id: string; className?: string }) {
  if (!phoneRegionShowsFlag(id)) {
    return <span aria-hidden className={cx("inline-flex h-3.5 w-5 shrink-0 items-center justify-center text-foreground-icon-secondary", className)}>
      <GlobeIcon className="size-3.5" />
    </span>;
  }
  const src = flagUrl(id);
  return <span aria-hidden className={cx(
    "inline-flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] bg-background-tertiary-default",
    "shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.12)]",
    className,
  )}>
    {src && <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />}
  </span>;
}

function RegionRow({ region, sectionKey, selected, locale }: { region: PhoneRegion; sectionKey: string; selected: boolean; locale: string }) {
  const name = phoneRegionName(region.id, locale);
  return <ListBoxItem id={`${sectionKey}:${region.id}`} textValue={name} aria-label={`${name} +${region.dialCode}`}
    className={({ isFocused }) => cx(MENU_ITEM, "px-2 py-1.5 text-body-2-medium", (isFocused || selected) && MENU_ITEM_ACTIVE)}>
    <span className="flex w-full min-w-0 items-center gap-2">
      <PhoneRegionFlag id={region.id} />
      <span className="min-w-0 flex-1 truncate" translate="no">{name}</span>
      <span className="text-text-secondary tabular-nums" translate="no">+{region.dialCode}</span>
      <CheckIcon aria-hidden className={cx("size-4 shrink-0 text-foreground-icon-primary", !selected && "invisible")} />
    </span>
  </ListBoxItem>;
}

/** "🇨🇳 +86 ▾" inside the phone field; opens a searchable list of every calling code. */
export function PhoneRegionPicker({ value, onChange, isDisabled }: { value: string; onChange: (id: string) => void; isDisabled?: boolean }) {
  const { language } = useApplicationLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const regions = useMemo(() => sortedPhoneRegions(language), [language]);
  const current = phoneRegion(value);
  const searching = query.trim().length > 0;
  const choose = (key: Key) => {
    onChange(String(key).split(":")[1]);
    setOpen(false);
  };

  return <PopoverTrigger isOpen={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
    <AriaButton isDisabled={isDisabled}
      aria-label={`国家或地区区号：${phoneRegionName(current.id, language)} +${current.dialCode}`}
      className={cx(
        "flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-1.5 text-body-2-medium text-text-primary outline-none",
        "transition-colors hover:bg-background-tertiary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring",
        "disabled:cursor-not-allowed disabled:text-text-disabled disabled:hover:bg-transparent",
        open && "bg-background-tertiary-hover",
      )}>
      <PhoneRegionFlag id={current.id} />
      <span className="tabular-nums" translate="no">+{current.dialCode}</span>
      <ChevronDownSmall className={cx("size-3.5 text-text-secondary transition-transform duration-200", open && "rotate-180")} />
    </AriaButton>
    <Popover aria-label="选择国家或地区区号" placement="bottom start" className="w-72" dialogClassName="gap-2 p-1">
      <Autocomplete inputValue={query} onInputChange={setQuery}
        filter={(_text, input, node) => phoneRegionMatches(phoneRegion(String(node.key).split(":")[1]), language, input)}>
        <Input aria-label="搜索国家、地区或区号" placeholder="搜索国家、地区或区号" leadingIcon={SearchIcon} autoFocus />
        <ListBox aria-label="国家或地区区号" onAction={choose}
          renderEmptyState={() => <p className="px-2 py-6 text-center text-body-2-regular text-text-secondary">没有匹配的国家或地区</p>}
          className="-mx-1 flex max-h-72 flex-col gap-0.5 overflow-y-auto px-1 outline-none">
          {!searching && <ListBoxSection id="common" className="flex flex-col gap-0.5 border-b border-separator-border pb-1">
            <Header className="px-2 pb-1 pt-0.5 text-caption-1-medium text-text-tertiary">常用</Header>
            {regions.common.map((region) =>
              <RegionRow key={region.id} region={region} sectionKey="common" selected={region.id === current.id} locale={language} />)}
          </ListBoxSection>}
          <ListBoxSection id="all" className="flex flex-col gap-0.5">
            {!searching && <Header className="px-2 pb-1 pt-1.5 text-caption-1-medium text-text-tertiary">全部国家和地区</Header>}
            {regions.all.map((region) =>
              <RegionRow key={region.id} region={region} sectionKey="all" selected={region.id === current.id} locale={language} />)}
          </ListBoxSection>
        </ListBox>
      </Autocomplete>
    </Popover>
  </PopoverTrigger>;
}
