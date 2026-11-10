import { ArrowLeftIcon, ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "@/components/foundations/icons/app-icons";

/** Navigation glyphs mirror; logos, media controls and trend arrows do not. */
const directionalIcons: ReadonlySet<unknown> = new Set([
  ArrowLeftIcon, ChevronLeftIcon, ArrowRightIcon, ChevronRightIcon,
  PanelLeftCloseIcon, PanelLeftOpenIcon,
]);

export function directionalIconClass(icon: unknown): string | undefined {
  return directionalIcons.has(icon) ? "rtl:rotate-180" : undefined;
}
