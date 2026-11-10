"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import { Modal as AriaModal, ModalOverlay } from "react-aria-components";
import { ModalDialog, ModalHeader } from "@/components/base/modal/modal";
import { AlertDialog } from "@/components/base/modal/modal";
import { useDirection } from "@/components/foundations/direction/direction";
import { ProfileSettingsPanel } from "./profile/profile-settings-panel";
import { UsageSettingsPanel } from "./usage/usage-settings-panel";
import { cx } from "@/utils/cx";
import { AppearanceSettingsPanel } from "./nekopapa-appearance-settings";
import { ConfigurationGroupPanel, ConnectionsSettingsPanel, HooksSettingsPanel } from "./nekopapa-configuration-settings";
import { DataSettingsPanel } from "./nekopapa-data-settings";
import { ModelSettingsPanel } from "./nekopapa-model-settings";
import { PluginSettingsPanel, SkillSettingsPanel, ToolSettingsPanel } from "./nekopapa-tool-settings";
import { AboutSettingsPanel, GeneralSettingsPanel, ShortcutsSettingsPanel } from "./workspace-settings-info";
import { settingsGroups, settingsSections, type SettingsSection } from "./workspace-settings-catalog";
import { SettingsDraftProvider } from "./settings-draft-context";
import { hasUnsavedSettingsDrafts, updateSettingsDraft } from "@/app/settings/settings-draft-state";

export type SettingsPage = SettingsSection;

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPage?: SettingsPage;
  onAfterClose?: () => void;
  requestCloseRef?: { current: (() => void) | null };
}

/** Runs after the animated overlay and its focus scope have left the DOM. */
function SettingsFocusReturn({ onAfterClose }: Pick<SettingsModalProps, "onAfterClose">) {
  const restore = useRef(onAfterClose);
  restore.current = onAfterClose;
  useEffect(() => () => { window.requestAnimationFrame(() => restore.current?.()); }, []);
  return null;
}

function SettingsPanel({ page, onClose }: {
  page: SettingsPage;
  onClose: () => void;
}) {
  switch (page) {
    case "general": return <GeneralSettingsPanel onClose={onClose} />;
    case "profile": return <ProfileSettingsPanel onClose={onClose} />;
    case "usage": return <UsageSettingsPanel onClose={onClose} />;
    case "appearance": return <AppearanceSettingsPanel onClose={onClose} />;
    case "model": return <ModelSettingsPanel onClose={onClose} />;
    case "tools": return <ToolSettingsPanel onClose={onClose} />;
    case "skills": return <SkillSettingsPanel onClose={onClose} />;
    case "plugins": return <PluginSettingsPanel onClose={onClose} />;
    case "data": return <DataSettingsPanel onClose={onClose} />;
    case "connections": return <ConnectionsSettingsPanel onClose={onClose} />;
    case "hooks": return <HooksSettingsPanel onClose={onClose} />;
    case "shortcuts": return <ShortcutsSettingsPanel onClose={onClose} />;
    case "about": return <AboutSettingsPanel onClose={onClose} />;
    default: return <ConfigurationGroupPanel group={page} onClose={onClose} />;
  }
}

/** BoardUI's two-pane settings shell, using NekoPapa's configuration panels. */
export function SettingsModal({ isOpen, onClose, defaultPage = "general", onAfterClose, requestCloseRef }: SettingsModalProps) {
  const localize = useTemplateCopy();
  const direction = useDirection();
  const [page, setPage] = useState<SettingsPage>(defaultPage);
  const [visited, setVisited] = useState<SettingsPage[]>([defaultPage]);
  const dirtyPagesRef = useRef<ReadonlySet<string>>(new Set());
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const activePanel = useRef<HTMLElement | null>(null);
  const focusAfterNavigation = useRef(false);
  const reportDraft = useCallback((section: string, dirty: boolean) => {
    const next = updateSettingsDraft(dirtyPagesRef.current, section, dirty);
    dirtyPagesRef.current = next;
  }, []);
  const requestClose = useCallback(() => {
    if (hasUnsavedSettingsDrafts(dirtyPagesRef.current)) setConfirmDiscard(true);
    else onClose();
  }, [onClose]);
  useEffect(() => {
    if (requestCloseRef) requestCloseRef.current = requestClose;
    return () => { if (requestCloseRef) requestCloseRef.current = null; };
  }, [requestClose, requestCloseRef]);
  const navigate = (next: SettingsPage) => {
    focusAfterNavigation.current = next !== page;
    setPage(next);
    setVisited((current) => current.includes(next) ? current : [...current, next]);
  };

  useLayoutEffect(() => {
    if (!focusAfterNavigation.current) return;
    focusAfterNavigation.current = false;
    activePanel.current?.focus();
  }, [page]);

  useEffect(() => {
    if (!isOpen) return;
    setPage(defaultPage);
    setVisited((current) => current.includes(defaultPage) ? current : [...current, defaultPage]);
  }, [defaultPage, isOpen]);

  const selected = settingsSections[page];

  return localize((
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) requestClose(); }}
      isDismissable
      dir={direction}
      className="group/settings fixed inset-0 z-100 flex items-center justify-center p-4"
    >
      <div aria-hidden className="absolute inset-0 bg-black/70 transition-opacity duration-300 ease-out group-data-[entering]/settings:opacity-0 group-data-[exiting]/settings:opacity-0" />
      <AriaModal className={cx(
        "relative flex h-[720px] max-h-[calc(100dvh-32px)] w-full max-w-[1000px] flex-col outline-none",
        "transform-gpu transition-[opacity,scale,filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "data-[entering]:opacity-0 data-[exiting]:opacity-0 motion-safe:data-[entering]:scale-[0.85] motion-safe:data-[entering]:blur-[4px] motion-safe:data-[exiting]:scale-[0.85] motion-safe:data-[exiting]:blur-[4px]",
      )}>
        <ModalDialog aria-label="NekoPapa 设置" className="h-full flex-row gap-0 py-0">
          <SettingsFocusReturn onAfterClose={onAfterClose} />
          <nav aria-label="设置分类" className="flex w-14 shrink-0 flex-col gap-5 overflow-y-auto overscroll-contain border-e border-separator-border bg-background-secondary-default p-2.5 sm:w-60">
            {settingsGroups.map((group) => <div key={group.label} className="flex flex-col gap-1.5 pt-1">
              <span className="hidden ps-2 text-body-2-medium text-text-tertiary sm:block">{group.label}</span>
              <div className="flex flex-col gap-1">
                {group.sections.map((section) => {
                  const entry = settingsSections[section];
                  const active = section === page;
                  return <button
                    key={section}
                    type="button"
                    aria-label={entry.label}
                    aria-current={active ? "page" : undefined}
                    title={entry.label}
                    onClick={() => navigate(section)}
                    className={cx(
                      "flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-2lg p-2 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                      active ? "bg-background-secondary-hover text-text-primary" : "text-text-secondary hover:bg-background-secondary-hover/60",
                    )}
                  >
                    <entry.icon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
                    <span className="hidden truncate text-body-medium sm:block">{entry.label}</span>
                  </button>;
                })}
              </div>
            </div>)}
          </nav>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ModalHeader title={selected.title} description={selected.description} closeLabel="关闭设置" className="px-6 pt-6 pb-4" />
            {visited.map((section) => <section
              key={section}
              ref={(node) => { if (section === page) activePanel.current = node; }}
              aria-label={settingsSections[section].title}
              tabIndex={-1}
              hidden={section !== page}
              style={{ display: section === page ? "flex" : "none" }}
              className="min-h-0 flex-1 flex-col gap-4 pb-6 outline-none"
            >
              <SettingsDraftProvider value={reportDraft}>
              <SettingsPanel page={section} onClose={requestClose} />
              </SettingsDraftProvider>
            </section>)}
          </div>
        </ModalDialog>
      </AriaModal>
      <AlertDialog
        isOpen={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="放弃未保存的更改？"
        description="设置中的草稿尚未保存。关闭后将丢弃这些更改。"
        variant="default"
        icon={false}
        cancelLabel="继续编辑"
        confirmLabel="放弃更改"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </ModalOverlay>
  ));
}
