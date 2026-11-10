import { useState, type ReactNode } from "react";
import { EllipsisIcon, PencilLineIcon, PlugIcon, PlusIcon, Trash2Icon } from "@/components/foundations/icons/app-icons";
import { Chip, CHIP_COLORS, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Dropdown, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { cx } from "@/utils/cx";

/**
 * Record rows from the BoardUI settings-modal Tools page (ServerTile,
 * ServerRow, ServerMenu, NewServerRow and the empty-state card), adapted to
 * NekoPapa's saved configuration records. The tile dot only says whether a
 * runtime service is connected; saved records never claim a live connection.
 */

/** 32px letter tile. Colours reuse the Chip status pairs so dark mode follows the tokens. */
export function RecordTile({ initial, color }: { initial: string; color: ChipColor }) {
  return <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg">
    <span translate="no" className={cx("flex size-8 items-center justify-center rounded-lg text-body-2-medium", CHIP_COLORS[color])}>{initial}</span>
    <span aria-hidden className="absolute -bottom-0.5 -start-0.5 size-2.5 rounded-full bg-foreground-icon-tertiary ring-2 ring-background-secondary-default" />
  </span>;
}

/** Bare "…" row action opening 编辑 / 删除. */
function RecordMenu({ id, name, onEdit, onRemove, onTest }: { id: string; name: string; onEdit: () => void; onRemove: () => void; onTest?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const items = [
    ...(onTest ? [{ label: "测试连接", icon: PlugIcon, action: onTest }] : []),
    { label: "编辑", icon: PencilLineIcon, action: onEdit },
    { label: "删除", icon: Trash2Icon, action: onRemove },
  ];
  return <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
    <DropdownTrigger id={id} aria-label={`${name}的操作`} className={cx(
      "flex size-7 shrink-0 items-center justify-center rounded-md text-foreground-icon-secondary transition-colors duration-150 ease",
      "hover:bg-background-secondary-hover", isOpen && "bg-background-secondary-hover",
    )}>
      <EllipsisIcon className="size-4 shrink-0" aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label={`${name}的操作`} placement="bottom end" className="w-[160px] p-2">
      <DropdownGroup>
        {items.map(({ label, icon: Icon, action }) => <DropdownItem key={label} className="px-2 py-1.5" onSelect={() => { setIsOpen(false); action(); }}>
          <Icon className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
          <span className="truncate text-body-medium whitespace-nowrap text-text-primary">{label}</span>
        </DropdownItem>)}
      </DropdownGroup>
    </DropdownPopover>
  </Dropdown>;
}

export interface RecordRowProps {
  menuId: string;
  name: string;
  initial: string;
  color: ChipColor;
  chips: readonly string[];
  summary: string;
  detail?: string;
  onEdit: () => void;
  onRemove: () => void;
  /** Model profiles: 测试连接 in the menu, and its latest result under the row. */
  onTest?: () => void;
  test?: { pending: boolean; ok?: boolean; message: string };
}

export function RecordRow({ menuId, name, initial, color, chips, summary, detail, onEdit, onRemove, onTest, test }: RecordRowProps) {
  return <li className="flex w-full items-center gap-2.5 border-b border-separator-border py-2.5 pe-2.5">
    <RecordTile initial={initial} color={color} />
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 truncate text-body-medium text-text-primary">{name}</p>
        {chips.map((chip) => <Chip key={chip} variant="caption" color="soft" className="shrink-0">{chip}</Chip>)}
      </div>
      <p className="truncate text-body-2-regular text-text-secondary">{summary}</p>
      {detail && <p className="truncate text-body-2-regular text-text-tertiary">{detail}</p>}
      {test && <p role="status" className={cx("text-body-2-regular", test.pending ? "text-text-tertiary" : test.ok ? "text-text-secondary" : "text-text-error-primary")}>{test.message}</p>}
    </div>
    <RecordMenu id={menuId} name={name} onEdit={onEdit} onRemove={onRemove} onTest={onTest} />
  </li>;
}

/** Dashed-tile "add" row closing a record list. */
export function NewRecordRow({ id, label, description, onPress, isDisabled }: {
  id: string;
  label: string;
  description: string;
  onPress: () => void;
  isDisabled?: boolean;
}) {
  return <button id={id} type="button" disabled={isDisabled} onClick={onPress} className={cx(
    "group flex w-full cursor-pointer items-center gap-2.5 py-2.5 pe-2.5 text-start outline-none",
    "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-50",
  )}>
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-tertiary-default transition-colors duration-150 ease group-hover:bg-background-tertiary-hover">
      <PlusIcon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
    </span>
    <span className="flex min-w-0 flex-col">
      <span className="text-body-medium text-text-primary">{label}</span>
      <span className="text-body-2-regular text-text-secondary">{description}</span>
    </span>
  </button>;
}

/** Centered empty-state card with one action. */
export function EmptyRecords({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-background-secondary-default px-6 py-8">
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="text-body-medium text-text-primary">{title}</p>
      <p className="max-w-[360px] text-body-2-regular text-text-secondary">{description}</p>
    </div>
    {action}
  </div>;
}

export function EmptyRecordsButton({ id, children, onPress }: { id: string; children: ReactNode; onPress: () => void }) {
  return <Button id={id} variant="secondary" size="small" leadingIcon={PlusIcon} onClick={onPress}>{children}</Button>;
}
