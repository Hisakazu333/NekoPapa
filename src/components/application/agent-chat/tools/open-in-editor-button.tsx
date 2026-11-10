import { useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { CodeIcon } from "@/components/foundations/icons/app-icons";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";
import { useEditorPreferences, type ExternalEditor } from "@/hooks/use-editor-preferences";

const EDITOR_NAMES: Record<ExternalEditor, string> = { system: "默认应用", vscode: "VS Code", cursor: "Cursor", zed: "Zed", jetbrains: "JetBrains IDE", xcode: "Xcode" };

/** Asks the desktop host to open a project file; rejects with the host's reason. */
export function openInEditor(root: string, path: string, editor: ExternalEditor): Promise<unknown> {
  return invoke("open_in_editor", { root, path, editor });
}

/**
 * Opens a project file in 设置 → 编辑器与终端 → 外部编辑器, through the desktop
 * host (src-tauri/src/editor_open.rs). The browser preview cannot start
 * other apps, so the button is not shown there.
 */
export function OpenInEditorButton({ root, path }: { root: string; path: string }) {
  const { external } = useEditorPreferences();
  const [problem, setProblem] = useState<string>();
  if (!isTauri()) return null;
  const open = () => {
    setProblem(undefined);
    openInEditor(root, path, external)
      .catch((error: unknown) => setProblem(typeof error === "string" ? error : "无法打开文件。"));
  };
  return <>
    {problem && <span role="alert" title={problem} className="max-w-[45%] shrink truncate text-caption-1-regular text-text-error-primary">{problem}</span>}
    <ToolbarIconButton icon={CodeIcon} label={`用${EDITOR_NAMES[external]}打开`} onPress={open} />
  </>;
}
