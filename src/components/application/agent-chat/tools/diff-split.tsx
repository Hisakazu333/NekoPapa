import type { DiffLine } from "@/app/project-workspace";
import { splitRows, type ChangedLine as Changed } from "@/app/diff-rows";
import { cx } from "@/utils/cx";

const tone = (line: Changed | undefined) => !line ? "bg-background-secondary-default/60"
  : line.kind === "add" ? "bg-status-lime-background/60 text-text-primary"
    : line.kind === "del" ? "bg-status-rose-background/60 text-text-primary" : "text-text-secondary";

/** 设置 → 编辑器与终端 → 差异视图: 并排. Old on the left, new on the right. */
export function SplitDiffRows({ lines, textClass, render }: {
  lines: readonly DiffLine[];
  textClass: string;
  render: (line: Changed) => React.ReactNode;
}) {
  return <tbody>
    {splitRows(lines).map((row, index) => row.header !== undefined
      ? <tr key={index} className="bg-background-secondary-default text-text-tertiary"><td colSpan={4} className="px-3 py-0.5 whitespace-pre">{row.header}</td></tr>
      : <tr key={index}>
        <td className={cx("w-px select-none px-2 text-end text-text-tertiary", tone(row.left))}>{row.left?.old ?? ""}</td>
        <td className={cx("w-1/2 border-e border-separator-border pe-3 ps-1 align-top", textClass, tone(row.left))}>{row.left && render(row.left)}</td>
        <td className={cx("w-px select-none px-2 text-end text-text-tertiary", tone(row.right))}>{row.right?.new ?? ""}</td>
        <td className={cx("w-1/2 pe-3 ps-1 align-top", textClass, tone(row.right))}>{row.right && render(row.right)}</td>
      </tr>)}
  </tbody>;
}
