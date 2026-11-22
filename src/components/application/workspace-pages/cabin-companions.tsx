import { useEffect, useState, type Ref } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/base/buttons/button";
import { Popover, PopoverHeader, PopoverTrigger } from "@/components/base/popover/popover";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { CheckIcon, ChevronDownIcon, UsersIcon } from "@/components/foundations/icons/app-icons";
import { cx } from "@/utils/cx";
import { useAccountSession } from "../account/account-session";

export interface CompanionProgress {
  level: number | null;
  affinity: number | null;
}

interface Companion extends CompanionProgress {
  key: string;
  name: string;
  current: boolean;
  available: boolean;
}

export function cabinProgress({ level, affinity }: CompanionProgress) {
  const parts: string[] = [];
  if (level != null) parts.push(`等级 ${level}`);
  if (affinity != null) parts.push(`默契 ${affinity}`);
  return parts.join(" · ");
}

interface CompanionSelection {
  selected: string | null;
  onSelect: (key: string | null) => void;
}

export function CabinCompanions({ selected, onSelect, trigger }: CompanionSelection & { trigger: Ref<HTMLButtonElement> }) {
  return <PopoverTrigger>
    <Button ref={trigger} size="small" variant="secondary" leadingIcon={UsersIcon} trailingIcon={ChevronDownIcon}>同伴</Button>
    <Popover placement="bottom end" dialogClassName="gap-1 p-0">
      {({ close }) => <CompanionList selected={selected} onSelect={(key) => { onSelect(key); close(); }} />}
    </Popover>
  </PopoverTrigger>;
}

function CompanionList({ selected, onSelect }: CompanionSelection) {
  const { setProfile } = useAccountSession();
  const [companions, setCompanions] = useState<Companion[]>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void invoke<Companion[]>("account_cabin_roster").then((items) => {
      if (active) setCompanions(items);
    }).catch(async (failure: unknown) => {
      if (!active) return;
      setError(typeof failure === "string" ? failure : "同伴名册加载失败，请重试。");
      const snapshot = await invoke<{ profile?: unknown }>("account_snapshot").catch(() => null);
      if (active && snapshot && !snapshot.profile) setProfile(undefined);
    });
    return () => { active = false; };
  }, [attempt, setProfile]);

  return <>
    <PopoverHeader title="同伴名册" description="可预览账号中已开放的同伴。" className="px-2.5 pt-2 pb-1.5" />
    {error ? <div className="flex flex-col items-start gap-2 px-2.5 pb-2">
      <p role="alert" className="text-body-2-regular text-text-secondary">{error}</p>
      <Button size="small" variant="secondary" onClick={(event) => {
        event.currentTarget.closest<HTMLElement>('[role="dialog"]')?.focus();
        setError("");
        setAttempt((value) => value + 1);
      }}>重试</Button>
    </div> : !companions ? <p role="status" className="flex items-center gap-2 px-2.5 py-3 text-body-2-regular text-text-secondary">
      <SpinnerGlyph size="sm" />正在读取同伴名册…
    </p> : companions.length === 0 ? <p className="px-2.5 py-3 text-body-2-regular text-text-secondary">账号暂时没有同伴。</p>
      : <ul className="max-h-[min(50vh,22rem)] space-y-0.5 overflow-y-auto overscroll-contain">
        {companions.map((companion) => {
          const active = selected === null ? companion.current : companion.key === selected;
          const status = companion.current ? "当前同伴" : active ? "预览中" : !companion.available ? "暂未开放" : undefined;
          const progress = cabinProgress(companion);
          return <li key={companion.key}>
            <Button variant="ghost" size="small" disabled={!companion.current && !companion.available}
              className={cx("h-auto min-h-12 w-full px-2.5 py-1.5 text-start [&>span]:w-full [&>span]:min-w-0",
                active && "bg-background-secondary-default")}
              onClick={() => onSelect(companion.current ? null : companion.key)}>
              <span className="flex w-full items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-body-2-medium" translate="no">{companion.name}</span>
                  {progress && <span className="block text-caption-1-regular text-text-secondary">{progress}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-caption-1-regular text-text-secondary">
                  {status}{active && <CheckIcon className="size-3.5" aria-hidden />}
                </span>
              </span>
            </Button>
          </li>;
        })}
      </ul>}
  </>;
}
