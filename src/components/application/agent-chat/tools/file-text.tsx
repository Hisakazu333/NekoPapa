import { useMemo } from "react";
import type { DiffLine } from "@/app/projects/project-workspace";
import { diffSides, languageForPath } from "@/app/projects/file-language";
import type { ChangedLine } from "@/app/projects/diff-rows";
import { useThemeMode } from "@/components/application/theme/theme-toggle";
import { cx } from "@/utils/cx";
import { CodeTokens, useHighlightedLines } from "../code-tokens";
import { SplitDiffRows } from "./diff-split";

const MAX_LINES = 20000;

/**
 * Read-only text with a line-number gutter; very long files stop at 20,000
 * lines. `wrap` (设置 → 编辑器与终端 → 自动换行) wraps long lines, one row per
 * line so the numbers stay beside their lines. With a `path` the text is
 * syntax-highlighted by its file type once the highlighter is ready.
 */
export function FileText({ text, wrap = false, path = "" }: { text: string; wrap?: boolean; path?: string }) {
  const all = text.split("\n");
  if (all.length > 1 && all[all.length - 1] === "") all.pop();
  const lines = all.slice(0, MAX_LINES);
  const tokens = useHighlightedLines(lines.join("\n"), languageForPath(path));
  const dark = useThemeMode() === "dark";
  const line = (index: number) => tokens?.[index] ? <CodeTokens tokens={tokens[index]} dark={dark} /> : lines[index];
  return <div className="min-h-0 flex-1 overflow-auto border-t border-separator-border bg-background-primary-default">
    {wrap
      ? <div translate="no" className="py-2 font-mono text-caption-1-regular leading-5">
        {lines.map((text, index) => <div key={index} className="flex">
          <span aria-hidden className="w-12 shrink-0 select-none pe-3 text-end text-text-tertiary">{index + 1}</span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-all pe-4 text-text-primary">{text ? line(index) : "\u200b"}</span>
        </div>)}
      </div>
      : <div translate="no" className="flex min-w-fit font-mono text-caption-1-regular leading-5">
        <pre aria-hidden className="sticky start-0 select-none bg-background-primary-default py-2 pe-3 ps-3 text-end text-text-tertiary">{lines.map((_, index) => index + 1).join("\n")}</pre>
        <pre className="flex-1 py-2 pe-4 text-text-primary">{tokens
          ? lines.map((_, index) => <span key={index}>{line(index)}{index < lines.length - 1 ? "\n" : ""}</span>)
          : lines.join("\n")}</pre>
      </div>}
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

/** 显示空白字符变化: spaces and tabs on changed lines as faint · and →. */
function Visible({ text }: { text: string }) {
  return <>{text.split(/([ \t]+)/).map((part, index) => /^[ \t]+$/.test(part)
    ? <span key={index} className="text-text-tertiary">{part.replace(/ /g, "·").replace(/\t/g, "→\t")}</span>
    : part)}</>;
}

/**
 * A diff with old / new line numbers, as 设置 → 编辑器与终端 asks: unified
 * (one row per line) or split (old | new), wrapped or not, and with
 * whitespace on changed lines made visible. With a `path` both sides are
 * highlighted as whole texts and each line takes its colors from its side.
 */
export function DiffText({ lines, split = false, wrap = false, whitespace = false, path = "" }: { lines: DiffLine[]; split?: boolean; wrap?: boolean; whitespace?: boolean; path?: string }) {
  const shown = useMemo(() => lines.slice(0, MAX_LINES), [lines]);
  const sides = useMemo(() => diffSides(shown), [shown]);
  const positions = useMemo(() => new Map(shown.map((line, at) => [line, at])), [shown]);
  const language = languageForPath(path);
  const oldTokens = useHighlightedLines(sides.oldText, language);
  const newTokens = useHighlightedLines(sides.newText, language);
  const dark = useThemeMode() === "dark";
  const textClass = wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre";
  const render = (line: ChangedLine) => {
    if (whitespace && line.kind !== "ctx") return <Visible text={line.text} />;
    const at = positions.get(line) ?? -1;
    const tokens = line.kind === "del" ? oldTokens?.[sides.old[at]] : newTokens?.[sides.new[at]];
    return tokens ? <CodeTokens tokens={tokens} dark={dark} /> : line.text;
  };
  return <div className="min-h-0 flex-1 overflow-auto border-t border-separator-border bg-background-primary-default">
    <table translate="no" className={cx("w-full border-collapse font-mono text-caption-1-regular leading-5", !wrap && "min-w-fit")}>
      {split ? <SplitDiffRows lines={shown} textClass={textClass} render={render} /> : <tbody>
        {shown.map((line, index) => <tr key={index} className={lineStyle[line.kind]}>
          {line.kind === "hunk" || line.kind === "meta"
            ? <td colSpan={4} className="px-3 py-0.5 whitespace-pre">{line.text}</td>
            : <>
              <td className="w-px select-none px-2 text-end text-text-tertiary">{line.old ?? ""}</td>
              <td className="w-px select-none px-2 text-end text-text-tertiary">{line.new ?? ""}</td>
              <td className={cx("w-px select-none ps-1", line.kind === "add" ? "text-status-lime-text" : line.kind === "del" ? "text-status-rose-text" : "")}>{sign[line.kind]}</td>
              <td className={cx("pe-4 ps-1", textClass)}>{render(line)}</td>
            </>}
        </tr>)}
      </tbody>}
    </table>
    {lines.length > MAX_LINES && <p className="px-3 py-2 text-caption-1-regular text-text-tertiary">只显示前 {MAX_LINES} 行差异。</p>}
  </div>;
}
