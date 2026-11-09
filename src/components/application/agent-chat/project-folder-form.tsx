import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { cx } from "@/utils/cx";

/**
 * Typed-path fallback for the browser preview, where the system folder picker
 * is unavailable. `onSubmitFolder` checks the path on this device and returns
 * the reason when it cannot be added (missing, not a folder, not a full path).
 */
export function ProjectFolderForm({ onSubmitFolder, notice, className, autoFocus }: {
  onSubmitFolder: (folder: string) => Promise<string | undefined>;
  notice?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const inputId = useId();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (checking) return;
    if (!draft.trim()) return setError("请输入文件夹路径。");
    setChecking(true);
    const problem = await onSubmitFolder(draft).finally(() => setChecking(false));
    setError(problem ?? "");
    if (!problem) setDraft("");
  };

  return <form onSubmit={(event) => void submit(event)} className={cx("flex flex-col gap-2", className)} aria-busy={checking || undefined}>
    <label htmlFor={inputId} className="text-caption-1-medium text-text-tertiary">文件夹路径</label>
    <div className="flex items-center gap-2">
      <Input id={inputId} value={draft} onChange={(next) => { setDraft(next); setError(""); }} size="small" autoFocus={autoFocus}
        placeholder="~/Projects/app" className="min-w-0 flex-1" aria-invalid={error ? true : undefined}
        aria-describedby={error || notice ? `${inputId}-error` : `${inputId}-hint`} />
      <Button type="submit" size="small" disabled={checking}>{checking ? "检查中…" : "添加"}</Button>
    </div>
    <p id={`${inputId}-hint`} className="text-caption-1-regular text-text-tertiary">浏览器预览无法打开系统文件夹窗口。输入完整路径，添加前会检查文件夹是否存在。</p>
    {(error || notice) && <p id={`${inputId}-error`} role="alert" className="text-caption-1-regular text-text-error-primary">{error || notice}</p>}
  </form>;
}
