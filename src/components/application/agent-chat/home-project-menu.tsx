import { useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { RiCheckLine, RiCloseLine, RiFolder3Line } from "@remixicon/react";
import { mergeProjectFolders, projectFolderName } from "@/app/project-folders";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { ChevronDownSmall } from "@/components/foundations/icons/chevrons";
import { useProjectFolders } from "@/hooks/use-project-folders";
import { cx } from "@/utils/cx";
import { ProjectFolderForm } from "./project-folder-form";

const OPTION = "flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-start outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring";

/**
 * Chooses the project folder the new workbench chat is grouped under. It only
 * records the choice: no files are read and no commands run until the
 * NekoBuddy backend and coding tools are connected.
 */
export function HomeProjectMenu({ value, onChange, knownFolders }: {
  value?: string;
  onChange: (folder: string | undefined) => void;
  /** Folders already used by stored chats, offered after the recent list. */
  knownFolders: readonly string[];
}) {
  const { folders, remember, forget, notice } = useProjectFolders();
  const [open, setOpen] = useState(false);
  const options = mergeProjectFolders(folders, knownFolders);
  const name = value ? projectFolderName(value) : undefined;

  const choose = (folder: string | undefined) => {
    const normalized = folder === undefined ? undefined : remember(folder);
    if (folder !== undefined && !normalized) return false;
    setOpen(false);
    onChange(normalized);
    return true;
  };

  return <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
    <AriaButton className="chat-home__toolbar-button" aria-label={name ? `当前项目文件夹：${name}，更换项目文件夹` : "选择项目文件夹"}>
      <RiFolder3Line aria-hidden />
      <span translate="no" className="max-w-[128px] truncate" title={value}>{name ?? "项目文件夹"}</span>
      <ChevronDownSmall className="chat-home__chevron" />
    </AriaButton>
    <Popover aria-label="选择项目文件夹" placement="bottom end" className="w-[320px]" dialogClassName="flex max-h-[min(480px,70dvh)] flex-col gap-1 overflow-y-auto overscroll-contain p-0 outline-none">
      <p className="px-2.5 pt-1 text-caption-1-medium text-text-tertiary">项目文件夹</p>
      <button type="button" className={OPTION} onClick={() => choose(undefined)}>
        <span className="flex-1 text-body-medium text-text-primary">不使用项目文件夹</span>
        {!value && <RiCheckLine className="size-4 shrink-0 text-foreground-icon-primary" aria-hidden />}
      </button>
      <ul className="flex flex-col">
        {options.map((folder) => <li key={folder} className="group/project relative">
          <button type="button" className={cx(OPTION, "pe-16")} onClick={() => choose(folder)} aria-current={folder === value ? "true" : undefined}>
            <RiFolder3Line className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span translate="no" className="truncate text-body-medium text-text-primary">{projectFolderName(folder)}</span>
              {folder !== projectFolderName(folder) && <span translate="no" className="truncate text-caption-1-regular text-text-tertiary">{folder}</span>}
            </span>
          </button>
          <span className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {folders.includes(folder) && <button type="button" aria-label={`从列表移除${projectFolderName(folder)}`} onClick={() => forget(folder)}
              className="flex size-6 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary opacity-0 outline-none hover:bg-background-tertiary-default focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border-focus-ring group-hover/project:opacity-100">
              <RiCloseLine className="size-4" aria-hidden />
            </button>}
            {folder === value && <RiCheckLine className="size-4 text-foreground-icon-primary" aria-hidden />}
          </span>
        </li>)}
      </ul>
      <ProjectFolderForm onSubmitFolder={choose} notice={notice} className="border-t border-border-button-default px-2.5 pb-2 pt-2.5" />
    </Popover>
  </PopoverTrigger>;
}
