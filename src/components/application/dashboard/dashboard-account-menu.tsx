import { useRef, useState } from "react";
import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import {
  RiFeedbackLine,
  RiGlobalLine,
  RiLoginBoxLine,
  RiPaletteLine,
  RiComputerLine,
  RiSunLine,
  RiMoonLine,
  RiQuestionLine,
  RiSettings3Line,
  RiUserLine,
} from "@remixicon/react";
import { Kbd } from "@/components/base/kbd/kbd";
import { Avatar } from "@/components/base/avatar/avatar";
import {
  Dropdown,
  DropdownDivider,
  DropdownGroup,
  DropdownItem,
  DropdownPopover,
  DropdownTrigger,
} from "@/components/base/dropdown/dropdown";
import { ChevronDownSmall } from "@/components/foundations/icons/chevrons";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { profileInitials } from "@/app/profile-identity";
import { desktopAccountApi } from "@/app/desktop-account-api";
import { useAccountPageNavigation } from "@/components/application/account/account-page-provider";
import { useWorkspaceSettings, type OpenWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import type { SettingsSection } from "@/components/application/settings/workspace-settings-catalog";
import { useApplicationLanguage } from "@/components/application/language/application-language";
import { Select, SelectItem } from "@/components/base/select/select";
import { AccentColorOptions } from "@/components/application/theme/accent-color-options";
import { normalizeAppearanceAccent, normalizeAppearanceMode, type AppearanceAccent, type AppearanceMode } from "@/app/appearance-preferences";
import { useConfiguration } from "@/hooks/use-configuration";
import { Button } from "@/components/base/buttons/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { cx } from "@/utils/cx";

export type AccountSettingsSection = SettingsSection;

function AccountAction({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: typeof RiUserLine;
  label: string;
  onSelect: () => void;
}) {
  return (
    <DropdownItem onSelect={onSelect}>
      <Icon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
      <span>{label}</span>
    </DropdownItem>
  );
}

function HelpLink({ href, icon: Icon, children }: { href: string; icon: typeof RiUserLine; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-2lg p-2 text-body-medium text-text-primary outline-none hover:bg-background-primary-hover focus-visible:bg-background-primary-hover"
    >
      <Icon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
      <span>{children}</span>
    </a>
  );
}

export function DashboardAccountMenu({
  collapsed = false,
  onOpenSettings,
}: {
  collapsed?: boolean;
  onOpenSettings?: OpenWorkspaceSettings;
}) {
  const localize = useTemplateCopy();
  const { profile } = useLocalProfile();
  const openSettings = useWorkspaceSettings();
  const openAccountPage = useAccountPageNavigation();
  const { language, setLanguage } = useApplicationLanguage();
  const { store, data, storageAvailable, notice, refresh } = useConfiguration();
  const [open, setOpen] = useState(false);
  const [languageError, setLanguageError] = useState<string>();
  const [appearanceError, setAppearanceError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const initials = profileInitials(profile.name);
  const settingsShortcut = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform) ? "⌘," : "Ctrl+,";
  const accountStatus = desktopAccountApi.availability.kind === "disabled" ? "登录暂未开放" : "未登录";
  const showSettings = (section: AccountSettingsSection) => {
    setOpen(false);
    // Pass the persistent trigger; the menu's temporary item may own focus.
    const trigger = container.current?.querySelector<HTMLButtonElement>("button");
    (onOpenSettings ?? openSettings)(section, trigger);
  };
  const showLogin = () => {
    setOpen(false);
    openAccountPage.open(container.current?.querySelector<HTMLButtonElement>("button"));
  };
  const chooseLanguage = (next: "zh-CN" | "en-US") => {
    if (next === language) return;
    const error = setLanguage(next);
    setLanguageError(error ?? undefined);
  };
  const chooseAppearance = (value: Partial<{ mode: AppearanceMode; accent: AppearanceAccent }>) => {
    const errors = store.saveGroup("appearance", { ...store.data.groups.appearance, ...value });
    refresh();
    setAppearanceError(errors ? Object.values(errors)[0] : store.storageAvailable ? "" : store.notice || "无法保存外观设置。");
  };
  const retryAppearanceSave = () => {
    const saved = store.persist();
    refresh();
    setAppearanceError(saved ? "" : store.notice || notice || "无法保存外观设置。");
  };
  const appearanceMode = normalizeAppearanceMode(data.groups.appearance.mode);
  const appearanceAccent = normalizeAppearanceAccent(data.groups.appearance.accent);

  return localize((
    <div ref={container} className="w-full">
      <Dropdown isOpen={open} onOpenChange={setOpen}>
        <DropdownTrigger
          aria-label={`账号与本机资料：${profile.name}`}
          className={cx(
            "flex items-center overflow-hidden border-2 border-transparent hover:border-border-button-hover",
            "transition-[width,background-color,border-color,padding] duration-300 ease-in-out",
            "focus-visible:ring-offset-2",
            collapsed
              ? "size-9 justify-start rounded-full bg-transparent p-0"
              : "w-full justify-between rounded-xl bg-background-tertiary-default py-2 pe-4 ps-2.5",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Avatar size="md" color="blue" initials={initials} alt={profile.name} />
            <span className={cx(
              "flex min-w-0 flex-col items-start overflow-hidden transition-[max-width,opacity,filter] duration-300 ease-in-out",
              collapsed ? "max-w-0 opacity-0 blur-[3px]" : "max-w-40 opacity-100 blur-0",
            )}>
              <span className="w-full truncate text-body-medium text-text-primary">{profile.name}</span>
              <span className="whitespace-nowrap text-body-regular text-text-secondary">本机资料 · 未登录</span>
            </span>
          </span>
          {!collapsed && (
            <span className="flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-background-tertiary-hover">
              <ChevronDownSmall className={cx("size-4 text-text-secondary transition-transform duration-200", open && "rotate-180")} />
            </span>
          )}
        </DropdownTrigger>
        {/* Opens beside the sidebar, bottom edges aligned, and never taller
            than the window below the title bar — so it cannot cover the
            traffic lights or the toolbar. The profile header is not repeated:
            the trigger already shows it. */}
        <DropdownPopover
          aria-label="账号菜单"
          placement="end bottom"
          offset={collapsed ? 20 : 24}
          className="max-h-[calc(100dvh-72px)] w-[280px] overflow-y-auto"
        >
          <DropdownGroup>
            <DropdownItem onSelect={showLogin}>
              <RiLoginBoxLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
              <span className="flex-1">登录 NekoPapa</span>
              <span className="text-caption-1-regular text-text-tertiary">{accountStatus}</span>
            </DropdownItem>
            <AccountAction icon={RiUserLine} label="本机资料" onSelect={() => showSettings("profile")} />
            <DropdownItem onSelect={() => showSettings("general")}>
              <RiSettings3Line className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
              <span className="flex-1">设置</span>
              <Kbd>{settingsShortcut}</Kbd>
            </DropdownItem>
          </DropdownGroup>
          <DropdownDivider />
          <DropdownGroup label="偏好">
            <div className="flex min-w-0 items-center justify-between gap-2 px-2 py-1">
              <span className="flex min-w-0 items-center gap-2 text-body-medium text-text-primary">
                <RiPaletteLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
                <span>外观</span>
              </span>
              <SegmentedControl data-theme-control aria-label="主题" selectedKeys={[appearanceMode]} className="shrink-0 rounded-full [&>span]:rounded-full"
                onSelectionChange={(keys) => {
                  const mode = Array.from(keys)[0];
                  if (mode === "system" || mode === "light" || mode === "dark") chooseAppearance({ mode });
                }}>
                <SegmentedControlItem id="system" aria-label="跟随系统" className="size-7 rounded-full px-0"><RiComputerLine className="size-4" aria-hidden /></SegmentedControlItem>
                <SegmentedControlItem id="light" aria-label="浅色" className="size-7 rounded-full px-0"><RiSunLine className="size-4" aria-hidden /></SegmentedControlItem>
                <SegmentedControlItem id="dark" aria-label="深色" className="size-7 rounded-full px-0"><RiMoonLine className="size-4" aria-hidden /></SegmentedControlItem>
              </SegmentedControl>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 px-2 py-1">
              <span className="text-body-medium text-text-primary">强调色</span>
              <AccentColorOptions compact value={appearanceAccent} onChange={(accent) => chooseAppearance({ accent })} />
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 px-2 py-1">
              <span className="flex min-w-0 items-center gap-2 text-body-medium text-text-primary">
                <RiGlobalLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
                <span>语言</span>
              </span>
              <Select aria-label="界面语言" selectedKey={language} size="sm" className="w-[152px] shrink-0"
                triggerClassName="border-border-button-default bg-background-secondary-default px-2 py-1 text-body-2-medium hover:bg-background-secondary-hover"
                onSelectionChange={(key) => {
                  setLanguageError(undefined);
                  if (key === "zh-CN" || key === "en-US") chooseLanguage(key);
                }}>
                <SelectItem id="en-US" textValue="English">
                  <span className="flex items-center gap-2"><img src="/boardui/flags/us.svg" alt="" aria-hidden="true" className="h-3.5 w-5 rounded-sm object-cover" /><span>English</span></span>
                </SelectItem>
                <SelectItem id="zh-CN" textValue="简体中文">
                  <span className="flex items-center gap-2"><img src="/boardui/flags/cn.svg" alt="" aria-hidden="true" className="h-3.5 w-5 rounded-sm object-cover" /><span>简体中文</span></span>
                </SelectItem>
              </Select>
            </div>
            {appearanceError && <div className="flex items-center justify-between gap-2 px-2 py-1">
              <p role="alert" className="min-w-0 text-body-2-regular text-text-error-primary">{appearanceError}</p>
              {!storageAvailable && <Button variant="secondary" size="xs" onClick={retryAppearanceSave}>重试</Button>}
            </div>}
            {languageError && <p role="alert" className="px-2 py-1 text-body-2-regular text-text-error-primary">{languageError}</p>}
          </DropdownGroup>
          <DropdownDivider />
          <DropdownGroup>
            <HelpLink href="https://github.com/Hisakazu333/NekoPapa#readme" icon={RiQuestionLine}>帮助文档</HelpLink>
            <HelpLink href="https://github.com/Hisakazu333/NekoPapa/issues" icon={RiFeedbackLine}>反馈问题</HelpLink>
          </DropdownGroup>
        </DropdownPopover>
      </Dropdown>
    </div>
  ));
}
