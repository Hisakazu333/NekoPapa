import { fileKind, type FileKind } from "@/app/projects/file-language";
import {
  FileArchiveIcon, FileAudioIcon, FileBracesIcon, FileCodeIcon, FileCogIcon, FileIcon, FileImageIcon, FileLockIcon, FileTextIcon, FileVideoIcon,
  type AppIcon,
} from "@/components/foundations/icons/app-icons";

const ICONS: Record<FileKind, AppIcon> = {
  code: FileCodeIcon, data: FileBracesIcon, config: FileCogIcon, text: FileTextIcon, image: FileImageIcon,
  audio: FileAudioIcon, video: FileVideoIcon, archive: FileArchiveIcon, lock: FileLockIcon, file: FileIcon,
};

/** The tree icon for a file, by what its name says it is. */
export const fileTypeIcon = (path: string): AppIcon => ICONS[fileKind(path)];
