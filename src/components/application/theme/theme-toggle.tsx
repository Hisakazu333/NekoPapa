"use client";

import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";

import { useRef, useSyncExternalStore } from "react";
import { revealTheme } from "@/platform/theme-transition";
import type { ThemeTransitionOrigin } from "@/platform/theme-transition";
import { MoonIcon, SunIcon } from "@/components/foundations/icons/app-icons";
import { Switch as AriaSwitch } from "react-aria-components";
import { SwitchTrack } from "@/components/base/switch/switch";
import { cx } from "@/utils/cx";
import { configurationStore, publishConfiguration } from "@/hooks/use-configuration";

export type ThemeMode = "light" | "dark";

export const THEME_CHANGE_EVENT = "nekopapa:chat-theme-change";

const THEME_TRANSITION_DURATION = 820;

export function applyTheme(theme: ThemeMode, { persist = true }: { persist?: boolean } = {}) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  if (persist) {
    const store = configurationStore();
    if (store.storageAvailable || store.persist()) {
      store.saveGroup("appearance", { ...store.data.groups.appearance, mode: theme });
    }
    publishConfiguration();
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }));
}

/** Reveal a resolved theme without replacing a saved system preference. */
export async function applyThemeWithTransition(
  theme: ThemeMode,
  options: Parameters<typeof revealTheme>[1] & { persist?: boolean } = {},
) {
  const { persist = true, animate = true, ...transitionOptions } = options;
  await revealTheme(() => applyTheme(theme, { persist }), {
    ...transitionOptions,
    animate: animate && currentTheme() !== theme,
  });
}

function currentTheme(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribe(onStoreChange: () => void) {
  const onThemeChange = () => onStoreChange();
  window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  };
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, currentTheme, () => "light");
}

export interface ThemeToggleProps {
  /** Compact icon-only treatment for a collapsed sidebar rail. */
  collapsed?: boolean;
  /**
   * Visual treatment for the control. `glass-segmented` is the landing nav's
   * skin: literal black/white rather than theme tokens, because it sits on the
   * hero shader's near-white band in both themes and a token that follows the
   * page would invert out of sight in dark mode.
   */
  appearance?: "sidebar" | "segmented" | "sidebar-segmented" | "glass-segmented";
  className?: string;
  /** Size of segmented controls; small fits inside dropdown rows. */
  size?: "small" | "medium";
  /** Circular reveal duration in milliseconds. */
  transitionDuration?: number;
}

/** Manual light/dark control. It never reads the operating-system theme. */
export function ThemeToggle({
  collapsed = false,
  appearance = "sidebar",
  className,
  size = "medium",
  transitionDuration = THEME_TRANSITION_DURATION,
}: ThemeToggleProps) {
  const localize = useTemplateCopy();
  const theme = useThemeMode();
  const dark = theme === "dark";
  const switchRef = useRef<HTMLLabelElement | null>(null);
  const pointerOriginRef = useRef<ThemeTransitionOrigin | null>(null);

  if (
    appearance === "segmented" ||
    appearance === "sidebar-segmented" ||
    appearance === "glass-segmented"
  ) {
    const glass = appearance === "glass-segmented";
    const small = size === "small" && !glass;
    const sidebarSurface = appearance === "sidebar-segmented";
    const options = [
      { mode: "light" as const, label: "Use light mode", Icon: SunIcon },
      { mode: "dark" as const, label: "Use dark mode", Icon: MoonIcon },
    ];

    return localize((
      <div
        role="group"
        aria-label="Theme"
        className={cx(
          "relative inline-flex w-fit items-center gap-1 rounded-full p-1",
          // Mobile: 2px padding + 28px segments = 32px tall, matching the
          // small icon buttons beside it. Desktop keeps the roomier 40px.
          glass && "p-0.5 sm:p-1",
          small && "gap-0.5 p-0.5",
          glass
            ? // No track of its own: the host supplies the surface. A fill
              // here would paint over it. Kept registry-safe — this component
              // never imports the landing page's glass.
              "z-10 bg-transparent"
            : sidebarSurface
              ? "bg-theme-toggle-sidebar-background"
              : "bg-background-secondary-default",
          className,
        )}
      >
        <span
          aria-hidden
          className={cx(
            "pointer-events-none absolute top-1 start-1 size-8 rounded-full",
            "shadow-xs transition-transform duration-200 ease",
            glass && "top-0.5 start-0.5 size-7 sm:top-1 sm:start-1 sm:size-8",
            small && "top-0.5 start-0.5 size-6",
            glass
              ? "bg-white dark:bg-[#2e2e33]"
              : sidebarSurface
                ? "bg-theme-toggle-sidebar-selected-background"
                : "bg-background-primary-default",
            // Segment width + the 4px gap: 28+4 on mobile, 32+4 above it.
            dark && (small ? "translate-x-6.5 rtl:-translate-x-6.5" : glass ? "translate-x-8 rtl:-translate-x-8 sm:translate-x-9 sm:rtl:-translate-x-9" : "translate-x-9 rtl:-translate-x-9"),
          )}
        />
        {options.map(({ mode, label, Icon }) => {
          const selected = theme === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-label={label}
              aria-pressed={selected}
              title={mode === "light" ? "Light mode" : "Dark mode"}
              onClick={(event) => {
                if (selected) return;
                const pointerOrigin =
                  event.clientX === 0 && event.clientY === 0
                    ? null
                    : { x: event.clientX, y: event.clientY };
                void applyThemeWithTransition(mode, {
                  origin: pointerOrigin,
                  element: event.currentTarget,
                  duration: transitionDuration,
                });
              }}
              className={cx(
                "relative z-10 grid size-8 cursor-pointer place-items-center rounded-full outline-none",
                glass && "size-7 sm:size-8",
                small && "size-6",
                "transition-colors duration-150 ease",
                "focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                glass
                  ? selected
                    ? // Reads against the selected pill, which is white in
                      // light and dark grey in dark — so it flips with it.
                      "text-black dark:text-white"
                    : "text-black/45 hover:text-black/70 dark:text-white/45 dark:hover:text-white/70"
                  : selected
                    ? "text-foreground-icon-primary"
                    : "text-foreground-icon-secondary hover:text-foreground-icon-primary",
              )}
            >
              <Icon className={small ? "size-3.5" : "size-4"} aria-hidden />
            </button>
          );
        })}
      </div>
    ));
  }

  if (collapsed) {
    const Icon = dark ? SunIcon : MoonIcon;
    return localize((
      <button
        type="button"
        aria-label={dark ? "Use light mode" : "Use dark mode"}
        aria-pressed={dark}
        title={dark ? "Light mode" : "Dark mode"}
        onClick={(event) => {
          const pointerOrigin =
            event.clientX === 0 && event.clientY === 0
              ? null
              : { x: event.clientX, y: event.clientY };
          void applyThemeWithTransition(dark ? "light" : "dark", {
            origin: pointerOrigin,
            element: event.currentTarget,
            duration: transitionDuration,
          });
        }}
        className={cx(
          "flex size-9 cursor-pointer items-center justify-center rounded-2lg",
          "text-foreground-icon-secondary transition-colors duration-150 ease",
          "hover:bg-background-secondary-hover hover:text-foreground-icon-primary",
          "outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
          className,
        )}
      >
        <Icon className="size-5" aria-hidden />
      </button>
    ));
  }

  return localize((
    <AriaSwitch
      ref={switchRef}
      isSelected={dark}
      onPointerDown={(event) => {
        pointerOriginRef.current = { x: event.clientX, y: event.clientY };
      }}
      onChange={(selected) => {
        const origin = pointerOriginRef.current;
        pointerOriginRef.current = null;
        void applyThemeWithTransition(selected ? "dark" : "light", {
          origin,
          element: switchRef.current,
          duration: transitionDuration,
        });
      }}
      aria-label="Dark mode"
      className={({ isFocusVisible }) =>
        cx(
          "flex w-full cursor-pointer items-center justify-between rounded-2lg p-2",
          "transition-colors duration-150 ease hover:bg-background-secondary-hover",
          isFocusVisible && "ring-2 ring-inset ring-border-focus-ring",
          className,
        )
      }
    >
      {(state) => (
        <>
          <span className="flex min-w-0 items-center gap-2">
            <MoonIcon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium text-text-secondary">Dark mode</span>
          </span>
          <SwitchTrack state={state} size="sm" shape="pill" />
        </>
      )}
    </AriaSwitch>
  ));
}
