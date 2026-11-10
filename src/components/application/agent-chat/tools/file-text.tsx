import type { DiffLine } from "@/app/project-workspace";
import { cx } from "@/utils/cx";

const MAX_LINES = 20000;

/** Read-only text with a line-number gutter; very long files stop at 20,000 lines. */
export function FileText({ text }: { text: string }) {
  const all = text.split("\n");
  if (all.length > 1 && all[all.length - 1] === "") all.pop();
  const lines = all.slice(0, MAX_LINES);
  return <div className="min-h-0 flex-1 overflow-auto border-t border-separator-border bg-background-primary-default">
    <div translate="no" className="flex min-w-fit font-mono text-caption-1-regular leading-5">
      <pre aria-hidden className="sticky start-0 select-none bg-background-primary-default py-2 pe-3 ps-3 text-end text-text-tertiary">{lines.map((_, index) => index + 1).join("\n")}</pre>
      <pre className="flex-1 py-2 pe-4 text-text-primary">{lines.join("\n")}</pre>
    </div>
    {all.length > MAX_LINES && <p className="px-3 py-2 text-caption-1-regular text-text-tertiary">只显示前 {MAX_LINES} 行，共 {all.length} 行。</p>}
  </div>;
}

const lineStyle: Record<DiffLine["kind"], string> = {
  add: "bg-status-lime-background/60 text-text-primary",
  del: "bg-status-rose-background/60 text-text-primary",
  ctx: "text-text-secondary",
  hunk: "bg-background-secondary-default text-text-tertiary",
  meta: "text-text-tertiary",
};
const sign: Record<DiffLine["kind"], string> = { add: "+", del: "−", ctx: " ", hunk: "", meta: "" };

/** A unified diff, one row per line with old / new line numbers. */
export function DiffText({ lines }: { lines: DiffLine[] }) {
  const shown = lines.slice(0, MAX_LINES);
  return <div className="min-h-0 flex-1 overflow-auto border-t border-separator-border bg-background-primary-default">
    <table translate="no" className="w-full min-w-fit border-collapse font-mono text-caption-1-regular leading-5">
      <tbody>
        {shown.map((line, index) => <tr key={index} className={lineStyle[line.kind]}>
          {line.kind === "hunk" || line.kind === "meta"
            ? <td colSpan={4} className="px-3 py-0.5 whitespace-pre">{line.text}</td>
            : <>
              <td className="w-px select-none px-2 text-end text-text-tertiary">{line.old ?? ""}</td>
              <td className="w-px select-none px-2 text-end text-text-tertiary">{line.new ?? ""}</td>
              <td className={cx("w-px select-none ps-1", line.kind === "add" ? "text-status-lime-text" : line.kind === "del" ? "text-status-rose-text" : "")}>{sign[line.kind]}</td>
              <td className="pe-4 ps-1 whitespace-pre">{line.text}</td>
            </>}
        </tr>)}
      </tbody>
    </table>
    {lines.length > MAX_LINES && <p className="px-3 py-2 text-caption-1-regular text-text-tertiary">只显示前 {MAX_LINES} 行差异。</p>}
  </div>;
}
