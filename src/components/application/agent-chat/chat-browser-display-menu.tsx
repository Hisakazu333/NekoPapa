import { useState } from "react";
import { RiAddLine, RiCheckLine, RiComputerLine, RiMacbookLine, RiSmartphoneLine, RiSubtractLine, RiTabletLine, RiAspectRatioLine } from "@remixicon/react";
import { Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { toolbarIconButtonClass } from "@/components/application/dashboard/toolbar-icon-button";
import {
  browserDevices, formatBrowserZoom, stepBrowserZoom, type BrowserDevice, type BrowserDisplay, type BrowserFrame,
} from "@/app/browser-display";
import { cx } from "@/utils/cx";

const icons: Record<BrowserDevice, typeof RiComputerLine> = {
  fit: RiAspectRatioLine, phone: RiSmartphoneLine, tablet: RiTabletLine, laptop: RiMacbookLine, desktop: RiComputerLine,
};
const stepButton = cx(toolbarIconButtonClass, "size-8 rounded-lg");

/**
 * 显示 menu of the built-in browser: lay the page out at a device's width, or
 * fit the area at a chosen zoom. The trigger shows the current zoom, so a
 * zoomed-out page is never a mystery.
 */
export function ChatBrowserDisplayMenu({ display, frame, onChange, isDisabled }: {
  display: BrowserDisplay;
  /** The frame actually applied, for the zoom a device mode works out. */
  frame?: BrowserFrame;
  onChange: (display: BrowserDisplay) => void;
  isDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fit = display.device === "fit";
  const zoom = frame?.zoom ?? display.zoom;
  const DeviceIcon = icons[display.device];
  const setZoom = (next: number) => onChange({ device: "fit", zoom: next });

  return <Dropdown isOpen={open} onOpenChange={setOpen}>
    <DropdownTrigger aria-label={`显示方式：${browserDevices.find((entry) => entry.id === display.device)?.label}，${formatBrowserZoom(zoom)}`}
      isDisabled={isDisabled} className={cx(toolbarIconButtonClass, "w-auto gap-1 px-1.5", open && "bg-background-primary-hover text-text-primary")}>
      <DeviceIcon className="size-4 shrink-0" aria-hidden />
      <span className="text-caption-1-medium tabular-nums">{formatBrowserZoom(zoom)}</span>
    </DropdownTrigger>
    <DropdownPopover aria-label="显示方式" placement="bottom end" className="w-[240px] p-2">
      <DropdownGroup label="按设备宽度显示">
        {browserDevices.map(({ id, label, width }) => {
          const Icon = icons[id];
          return <DropdownItem key={id} selected={display.device === id} className="px-2 py-1.5"
            onSelect={() => { onChange({ device: id, zoom: id === "fit" ? display.zoom : 1 }); setOpen(false); }}>
            <Icon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
            <span className="flex-1 truncate text-start text-body-medium text-text-primary">{label}</span>
            <span className="text-caption-1-regular tabular-nums text-text-tertiary">{width ? `${width}px` : "当前宽度"}</span>
            <RiCheckLine className={cx("size-4 shrink-0 text-text-primary", display.device !== id && "invisible")} aria-hidden />
          </DropdownItem>;
        })}
      </DropdownGroup>
      <DropdownDivider />
      <DropdownGroup label="缩放">
        <div className="flex items-center gap-1 px-1">
          <button type="button" className={stepButton} aria-label="缩小" disabled={fit && zoom <= 0.5} onClick={() => setZoom(stepBrowserZoom(zoom, -1))}>
            <RiSubtractLine className="size-4" aria-hidden />
          </button>
          <span className="flex-1 text-center text-body-medium tabular-nums text-text-primary" aria-live="polite">{formatBrowserZoom(zoom)}</span>
          <button type="button" className={stepButton} aria-label="放大" disabled={fit && zoom >= 1.5} onClick={() => setZoom(stepBrowserZoom(zoom, 1))}>
            <RiAddLine className="size-4" aria-hidden />
          </button>
          <button type="button" disabled={fit && zoom === 1} onClick={() => setZoom(1)}
            className="ms-1 cursor-pointer rounded-lg px-2 py-1 text-body-2-medium text-text-secondary hover:bg-background-primary-hover disabled:cursor-not-allowed disabled:opacity-40">
            重置
          </button>
        </div>
        <p className="px-2 text-caption-1-regular text-text-tertiary">
          {fit ? `网页按 ${frame ? `${frame.layoutWidth}px` : "当前"} 宽度排版。缩小可看到更多内容。` : "设备模式按宽度自动缩放；调整缩放会回到“适应区域”。只模拟宽度，网站仍识别为电脑浏览器。"}
        </p>
      </DropdownGroup>
    </DropdownPopover>
  </Dropdown>;
}
