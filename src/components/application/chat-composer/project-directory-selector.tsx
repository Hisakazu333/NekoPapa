import { useRef, useState } from "react";
import { RiCloseLine, RiFolderOpenLine } from "@remixicon/react";
import { clearComposerProjectDirectory, selectComposerProjectDirectory } from "@/app/chat-composer-draft";
import { Button } from "@/components/base/buttons/button";
import type { ChatComposerState } from "@/hooks/use-chat-composer";

export function ProjectDirectorySelector({ state, disabled = false }: { state: ChatComposerState; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const selectDirectory = (files: FileList | null) => {
    if (!files?.length) return;
    const current = state.draft;
    const next = selectComposerProjectDirectory(current, Array.from(files));
    if (next === current) {
      setError("无法读取文件夹名称，请重新选择。");
      return;
    }
    state.setDraft(() => next);
    setError("");
  };
  const clear = () => {
    state.setDraft(clearComposerProjectDirectory);
    setError("");
  };

  return <div className="flex min-w-0 items-center gap-1">
    <input ref={(node) => { input.current = node; node?.setAttribute("webkitdirectory", ""); }}
      type="file" aria-label="选择 Coding 项目目录" className="hidden"
      onChange={(event) => {
        selectDirectory(event.currentTarget.files);
        event.currentTarget.value = "";
      }} />
    <Button variant={state.draft.projectDirectory ? "secondary" : "ghost"} size="small"
      leadingIcon={RiFolderOpenLine} disabled={disabled}
      aria-label={state.draft.projectDirectory ? `项目目录：${state.draft.projectDirectory}` : "选择项目目录"}
      title={state.draft.projectDirectory || "选择项目目录"}
      onClick={() => input.current?.click()} className="max-w-44 min-w-0">
      <span className="truncate">{state.draft.projectDirectory || "项目目录"}</span>
    </Button>
    {state.draft.projectDirectory && <Button variant="ghost" size="small" iconOnly leadingIcon={RiCloseLine}
      disabled={disabled} aria-label="清除项目目录" title="清除项目目录" onClick={clear} />}
    <span role={error ? "alert" : "status"} className="sr-only">
      {error || (state.draft.projectDirectory ? `已选择文件夹 ${state.draft.projectDirectory}。当前仅暂存名称，执行服务未连接。` : "")}
    </span>
  </div>;
}
