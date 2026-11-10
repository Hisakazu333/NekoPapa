import { useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { CheckIcon, FolderIcon, FolderPlusIcon } from "@/components/foundations/icons/app-icons";
import { resolveProject, type Project } from "@/app/projects";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { ChevronDownSmall } from "@/components/foundations/icons/chevrons";
import { ProjectFolderDetail } from "@/components/application/projects/project-folder-detail";
import { useProjectFolderChooser } from "@/hooks/use-project-folder-chooser";
import { useProjectFolderInfo } from "@/hooks/use-project-folder-info";
import { useProjects } from "@/hooks/use-projects";
import { cx } from "@/utils/cx";
import { ProjectFolderForm } from "./project-folder-form";

const OPTION = "flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-start outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-default disabled:opacity-60";

/** Pinned projects first, then the stored order. */
const menuOrder = (projects: readonly Project[]) => [...projects.filter((p) => p.pinned), ...projects.filter((p) => !p.pinned)];

/**
 * Chooses the project the new workbench chat belongs to. Each project shows
 * its primary folder's live Git branch; "添加文件夹…" makes a project from a
 * folder chosen in the system picker (desktop) or typed (browser preview),
 * checked on this device first. Editing and removal live in the sidebar.
 * Choosing only records the project: no files are listed and no commands run.
 */
export function HomeProjectMenu({ value, onChange }: {
  /** The chat's stored project value: a project id or a legacy folder path. */
  value?: string;
  onChange: (projectId: string | undefined) => void;
}) {
  const { projects, addFolder, notice } = useProjects();
  const chooser = useProjectFolderChooser();
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const selected = resolveProject(projects, value);
  const options = menuOrder(projects);
  const infoOf = useProjectFolderInfo(options.map((project) => project.folders[0]), open);

  const setMenuOpen = (next: boolean) => {
    setOpen(next);
    if (!next) { setTyping(false); chooser.clearError(); }
  };
  const choose = (projectId: string | undefined) => {
    setMenuOpen(false);
    onChange(projectId);
  };
  const selectFolder = (folder: string) => {
    const { project } = addFolder(folder);
    if (project) choose(project.id);
    return project ? undefined : "无法使用这个文件夹路径。";
  };
  const addTyped = async (path: string) => {
    const { folder, error } = await chooser.check(path);
    return error ?? selectFolder(folder!);
  };
  const addPicked = async () => {
    if (!chooser.desktop) return setTyping(true);
    const { folder } = await chooser.pick();
    if (folder) selectFolder(folder);
  };

  return <PopoverTrigger isOpen={open} onOpenChange={setMenuOpen}>
    <AriaButton className="chat-home__toolbar-button" aria-label={selected ? `当前项目：${selected.name}，更换项目` : "选择项目"}>
      <FolderIcon aria-hidden />
      <span translate="no" className="max-w-[128px] truncate" title={selected?.folders[0]}>{selected?.name ?? "项目"}</span>
      <ChevronDownSmall className="chat-home__chevron" />
    </AriaButton>
    <Popover aria-label="选择项目" placement="bottom end" className="w-[320px]" dialogClassName="flex max-h-[min(480px,70dvh)] flex-col gap-1 overflow-y-auto overscroll-contain p-0 outline-none">
      <p className="px-2.5 pt-1 text-caption-1-medium text-text-tertiary">项目</p>
      <button type="button" className={OPTION} onClick={() => choose(undefined)}>
        <span className="flex-1 text-body-medium text-text-primary">不使用项目</span>
        {!selected && <CheckIcon className="size-4 shrink-0 text-foreground-icon-primary" aria-hidden />}
      </button>
      <ul className="flex flex-col">
        {options.map((project) => <li key={project.id}>
          <button type="button" className={OPTION} onClick={() => choose(project.id)} aria-current={project.id === selected?.id ? "true" : undefined}
            title={project.folders.join("\n")}>
            <FolderIcon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span translate="no" className="truncate text-body-medium text-text-primary">{project.name}</span>
                {project.folders.length > 1 && <span className="shrink-0 text-caption-1-regular text-text-tertiary">{project.folders.length} 个文件夹</span>}
              </span>
              <ProjectFolderDetail folder={project.folders[0]} info={infoOf(project.folders[0])} />
            </span>
            {project.id === selected?.id && <CheckIcon className="size-4 shrink-0 text-foreground-icon-primary" aria-hidden />}
          </button>
        </li>)}
      </ul>
      <div className={cx("flex flex-col gap-1 pt-1", options.length > 0 && "border-t border-border-button-default")}>
        {typing
          ? <ProjectFolderForm autoFocus onSubmitFolder={addTyped} notice={notice} className="px-2.5 pb-2 pt-1.5" />
          : <button type="button" className={OPTION} onClick={() => void addPicked()} disabled={chooser.picking}>
            <FolderPlusIcon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
            <span className="flex-1 text-body-medium text-text-primary">{chooser.picking ? "正在打开文件夹窗口…" : "添加文件夹…"}</span>
          </button>}
        {chooser.error && <div role="alert" className="flex flex-col items-start gap-1 px-2.5 pb-2">
          <p className="text-caption-1-regular text-text-error-primary">{chooser.error}</p>
          {!typing && <button type="button" onClick={() => setTyping(true)}
            className="cursor-pointer rounded-md text-caption-1-medium text-text-secondary underline underline-offset-2 outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">改为输入路径</button>}
        </div>}
        {notice && !typing && <p role="alert" className="px-2.5 pb-2 text-caption-1-regular text-text-error-primary">{notice}</p>}
      </div>
    </Popover>
  </PopoverTrigger>;
}
