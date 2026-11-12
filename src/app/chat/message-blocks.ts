/**
 * A reply split into prose and fenced code blocks (```lang … ```). A fence
 * still open at the end — the reply is streaming — is a code block too, so
 * code shows as code while it arrives.
 */
export type MessageBlock =
  | { kind: "text"; text: string }
  | { kind: "code"; lang: string; code: string; complete: boolean };

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)[^\n]*$/;

export function splitMessageBlocks(text: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  const lines = text.split("\n");
  let prose: string[] = [];
  const flush = () => { if (prose.join("\n").trim()) blocks.push({ kind: "text", text: prose.join("\n") }); prose = []; };
  for (let index = 0; index < lines.length; index++) {
    const open = FENCE.exec(lines[index]);
    if (!open) { prose.push(lines[index]); continue; }
    flush();
    const marker = open[1];
    const code: string[] = [];
    let complete = false;
    for (index++; index < lines.length; index++) {
      const line = lines[index];
      if (line.trimStart().startsWith(marker[0].repeat(marker.length)) && line.trim().replace(/[`~]/g, "") === "") { complete = true; break; }
      code.push(line);
    }
    blocks.push({ kind: "code", lang: open[2].toLowerCase(), code: code.join("\n"), complete });
  }
  flush();
  return blocks;
}

const DISPLAY_MATH = /(^|[^\\])\\\[([\s\S]+?)\\\]/g;
const DISPLAY_LINE = /^[ \t]*\$\$(?!\s*$)(.+?)\$\$[ \t]*$/gm;
const INLINE_MATH =/(^|[^\\])\\\(([\s\S]+?)\\\)/g;

/**
 * Models often write LaTeX as \( … \) and \[ … \]; the Markdown math syntax
 * is $ … $ and $$ … $$. Converts the former outside inline code so both
 * render. An escaped "\\(" stays as written.
 */
export function normalizeMathDelimiters(text: string): string {
  return text.split(/(`+[^`\n]*`+)/).map((part, index) => index % 2 === 1 ? part : part
    // A line that is only $$ … $$ is display math, not inline.
    .replace(DISPLAY_LINE, (_, body: string) => `$$\n${body.trim()}\n$$`)
    .replace(DISPLAY_MATH, (_, before: string, body: string) => `${before}\n$$\n${body.trim()}\n$$\n`)
    .replace(INLINE_MATH, (_, before: string, body: string) => `${before}$${body.trim()}$`)).join("");
}
