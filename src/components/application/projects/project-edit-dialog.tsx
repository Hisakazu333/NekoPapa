import { useState } from "react";
import { FolderIcon, FolderPlusIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { PROJECT_FOLDER_MAX, projectWithFolder, type Project } from "@/app/projects";
import { projectFolderName } from "@/app/project-folders";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { ProjectFolderForm } from "@/components/application/agent-chat/project-folder-form";
import { useProjectFolderChooser } from "@/hooks/use-project-folder-chooser";
import { useProjectFolderInfo } from "@/hooks/use-project-folder-info";
import { useProjects } from "@/hooks/use-projects";
import { ProjectFolderDetail } from "./project-folder-detail";

const ROW = "flex min-h-14 items-center gap-3 border-b border-border-button-default px-3 py-2 last:border-b-0";
const ICON_BUTTON = "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none hover:bg-background-tertiary-default hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Edits a local project: its name and source folders. The first folder is the
 * primary one; others can be promoted or removed (a project keeps at least
 * one). New folders come from the system picker (desktop) or a typed path
 * (browser preview) and are checked on this device. Nothing is saved until
 * 保存; closing discards the draft. Chats stay in the project either way.
 */
export function ProjectEditDialog({ project, onClose, onRemove }: {
  project: Project;
  onClose: () => void;
  /** Asks to remove the whole project (the caller confirms). */
  onRemove: () => void;
}) {
  const { projects, update } = useProjects();
  const chooser = useProjectFolderChooser();
  const [name, setName] = useState(project.name);
  const [folders, setFolders] = useState<string[]>(project.folders);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const infoOf = useProjectFolderInfo(folders, true);

  const addToDraft = (folder: string): string | undefined => {
    if (folders.includes(folder)) return "这个文件夹已在列表中。";
    const owner = projectWithFolder(projects, folder);
    if (owner && owner.id !== project.id) return `这个文件夹已属于项目“${owner.name}”。`;
    if (folders.length >= PROJECT_FOLDER_MAX) return `每个项目最多 ${PROJECT_FOLDER_MAX} 个文件夹。`;
    setFolders((current) => [...current, folder]);
    setTyping(false);
    return undefined;
  };
  const addFolder = async () => {
    setError("");
    if (!chooser.desktop) return setTyping(true);
    const { folder } = await chooser.pick();
    if (folder) {
      const problem = addToDraft(folder);
      if (problem) chooser.setError(problem);
    }
  };
  const save = () => {
    const problem = update(project.id, { name, folders });
    if (problem) return setError(problem);
    onClose();
  };

  return <Modal isOpen size="md" onOpenChange={(open) => { if (!open) onClose(); }}>
    <ModalHeader title="编辑项目" closeLabel="关闭" />
    <ModalBody className="flex flex-col gap-4">
      <Input aria-label="项目名称" value={name} onChange={(next) => { setName(next); setError(""); }} leadingIcon={FolderIcon} autoFocus />
      <div className="flex flex-col gap-2">
        <p className="text-body-2-medium text-text-primary">源文件夹</p>
        <ul aria-label="源文件夹" className="flex flex-col rounded-2xl border border-border-button-default">
          {folders.map((folder, index) => <li key={folder} className={ROW}>
            <FolderIcon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span translate="no" className="truncate text-body-medium text-text-primary" title={folder}>{projectFolderName(folder)}</span>
              <ProjectFolderDetail folder={folder} info={infoOf(folder)} />
            </span>
            {index === 0
              ? <span className="shrink-0 rounded-lg border border-border-button-default px-2 py-0.5 text-caption-1-medium text-text-secondary">主要</span>
              : <Button type="button" variant="secondary" size="xs" onClick={() => { setFolders((current) => [folder, ...current.filter((entry) => entry !== folder)]); setError(""); }}>设为主要</Button>}
            <button type="button" className={ICON_BUTTON} disabled={folders.length === 1} aria-label={`移除文件夹 ${projectFolderName(folder)}`}
              title={folders.length === 1 ? "项目至少需要一个文件夹" : undefined}
              onClick={() => { setFolders((current) => current.filter((entry) => entry !== folder)); setError(""); }}>
              <XIcon className="size-4" aria-hidden />
            </button>
          </li>)}
          <li className={ROW}>
            {typing
              ? <ProjectFolderForm autoFocus className="w-full" onSubmitFolder={async (path) => {
                const { folder, error: problem } = await chooser.check(path);
                return problem ?? addToDraft(folder!);
              }} />
              : <button type="button" onClick={() => void addFolder()} disabled={chooser.picking || folders.length >= PROJECT_FOLDER_MAX}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-50">
                <FolderPlusIcon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
                <span className="text-body-medium text-text-primary">{chooser.picking ? "正在打开文件夹窗口…" : "添加文件夹"}</span>
              </button>}
          </li>
        </ul>
        {chooser.error && !typing && <p role="alert" className="text-caption-1-regular text-text-error-primary">{chooser.error}</p>}
        <p className="text-caption-1-regular text-text-tertiary">只记录文件夹位置和 Git 分支，不会读取或修改文件。</p>
      </div>
      {error && <p role="alert" className="text-body-2-regular text-text-error-primary">{error}</p>}
    </ModalBody>
    <ModalFooter>
      <Button type="button" variant="secondary" className="text-text-error-primary sm:me-auto" onClick={onRemove}>移除本地项目</Button>
      <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
      <Button type="button" onClick={save}>保存</Button>
    </ModalFooter>
  </Modal>;
}
