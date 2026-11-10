import { useConfiguration } from "./use-configuration";

export type ExternalEditor = "system" | "vscode" | "cursor" | "zed" | "jetbrains" | "xcode";

/** 设置 → 编辑器与终端 as the 文件 and 更改 panels use it. */
export function useEditorPreferences() {
  const { data } = useConfiguration();
  const group = data.groups.editor ?? {};
  return {
    external: String(group.external ?? "system") as ExternalEditor,
    split: group.diff === "split",
    wrap: group.wrap !== false,
    whitespace: group.whitespace === true,
  };
}
