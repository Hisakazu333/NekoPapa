import { useId, useRef, useState, type FormEvent } from "react";
import { RiFolderAddLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { cx } from "@/utils/cx";

/**
 * Adds a project folder by typed path or by the browser folder picker (which
 * only reveals the folder name). Shared by the composer picker and the sidebar.
 * `onSubmitFolder` returns false when the value cannot be used.
 */
export function ProjectFolderForm({ onSubmitFolder, notice, className }: {
  onSubmitFolder: (folder: string) => boolean;
  notice?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const browseRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const add = (folder: string) => {
    if (!onSubmitFolder(folder)) return setError("请输入有效的文件夹路径。");
    setError("");
    setDraft("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return setError("请输入文件夹路径。");
    add(draft);
  };

  return <form onSubmit={submit} className={cx("flex flex-col gap-2", className)}>
    <label htmlFor={inputId} className="text-caption-1-medium text-text-tertiary">添加文件夹</label>
    <div className="flex items-center gap-2">
      <Input id={inputId} value={draft} onChange={(next) => { setDraft(next); setError(""); }} size="small"
        placeholder="~/Projects/app" className="min-w-0 flex-1" aria-invalid={error ? true : undefined}
        aria-describedby={error || notice ? `${inputId}-error` : undefined} />
      <Button type="submit" size="small">添加</Button>
    </div>
    <input ref={(node) => { browseRef.current = node; node?.setAttribute("webkitdirectory", ""); }} type="file" className="hidden" tabIndex={-1}
      aria-hidden onChange={(event) => {
        const first = event.currentTarget.files?.[0]?.webkitRelativePath;
        event.currentTarget.value = "";
        if (first) add(first.split("/")[0]);
      }} />
    <button type="button" onClick={() => browseRef.current?.click()}
      className="flex cursor-pointer items-center gap-1.5 self-start rounded-md text-body-2-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
      <RiFolderAddLine className="size-4" aria-hidden />浏览文件夹
    </button>
    <p className="text-caption-1-regular text-text-tertiary">只用于给对话分组；浏览只能读取文件夹名称，需要完整路径时请直接输入。</p>
    {(error || notice) && <p id={`${inputId}-error`} role="alert" className="text-caption-1-regular text-text-error-primary">{error || notice}</p>}
  </form>;
}
