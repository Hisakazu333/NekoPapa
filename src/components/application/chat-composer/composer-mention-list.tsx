import { FileIcon } from "@/components/foundations/icons/app-icons";
import type { FileMention } from "@/hooks/use-file-mention";
import { cx } from "@/utils/cx";

/** The @ menu's list above the composer: matching project files, the chosen one highlighted. */
export function ComposerMentionList({ mention }: { mention: FileMention }) {
  if (!mention.open) return null;
  const empty = mention.loading ? "正在读取项目文件…" : mention.error ?? (mention.results.length === 0 ? "没有匹配的文件" : null);
  return <div className="absolute inset-x-4 bottom-full z-20 mb-1 overflow-hidden rounded-2xl border border-separator-border bg-background-primary-default py-1 shadow-card sm:inset-x-7">
    <p className="px-3 pt-1 pb-0.5 text-caption-1-medium text-text-tertiary">引用项目文件 · ↑↓ 选择 · Enter 插入 · Esc 关闭</p>
    {empty ? <p role="status" className="px-3 py-1.5 text-body-2-regular text-text-tertiary">{empty}</p>
      : <ul id={mention.listId} role="listbox" aria-label="项目文件" className="max-h-64 overflow-y-auto">
        {mention.results.map((path, index) => {
          const slash = path.lastIndexOf("/");
          return <li key={path} id={mention.optionId(index)} role="option" aria-selected={index === mention.active}
            onMouseDown={(event) => { event.preventDefault(); mention.pick(path); }}
            className={cx("flex cursor-pointer items-center gap-2 px-3 py-1.5", index === mention.active ? "bg-background-secondary-default" : "hover:bg-background-secondary-default")}>
            <FileIcon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
            <span translate="no" className="shrink-0 text-body-2-medium text-text-primary">{path.slice(slash + 1)}</span>
            {slash > 0 && <span translate="no" className="min-w-0 truncate font-mono text-caption-1-regular text-text-tertiary">{path.slice(0, slash)}</span>}
          </li>;
        })}
      </ul>}
  </div>;
}
