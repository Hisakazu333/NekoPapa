/**
 * File-name patterns for the Agent's find_files and search_files tools, and
 * the regular expression the host matches paths with. `*` is any run within
 * one folder name, `**` any number of folders, `?` one character, `{a,b}`
 * either, `[abc]` one of. A pattern with no `/` matches the name at any depth
 * ("*.ts" finds src/a.ts), as people expect from ignore files.
 *
 * The output is written in the syntax JavaScript and Rust's regex crate share
 * (no lookaround, only `(?:…)` groups), because the desktop host compiles
 * the same text for search_files.
 */
const SPECIAL = new Set([..."\\.+*?()|[]{}^$#&-~"]);
const escape = (char: string) => (SPECIAL.has(char) ? `\\${char}` : char);

export function globSource(pattern: string): string {
  const glob = pattern.trim().replace(/^\.\//, "").replace(/\/+$/, "");
  let out = "";
  let braces = 0;
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*") {
      if (glob[index + 1] === "*") {
        const slash = glob[index + 2] === "/";
        // "**/" is zero or more folders; a trailing "**" is everything below.
        out += slash ? "(?:[^/]+/)*" : ".*";
        index += slash ? 2 : 1;
      } else out += "[^/]*";
    } else if (char === "?") out += "[^/]";
    else if (char === "{") { braces += 1; out += "(?:"; }
    else if (char === "}" && braces > 0) { braces -= 1; out += ")"; }
    else if (char === "," && braces > 0) out += "|";
    else if (char === "[") {
      const end = glob.indexOf("]", index + 2);
      if (end < 0) { out += "\\["; continue; }
      const body = glob.slice(index + 1, end).replace(/^!/, "^");
      out += `[${[...body].map((each, at) => (each === "^" && at === 0) || each === "-" ? each : escape(each)).join("")}]`;
      index = end;
    } else out += escape(char);
  }
  out += ")".repeat(braces);
  return glob.includes("/") ? `^${out}$` : `(?:^|/)${out}$`;
}

/** Whether `path` (relative, with `/`) matches the glob. */
export function globMatcher(pattern: string): (path: string) => boolean {
  const regex = new RegExp(globSource(pattern));
  return (path) => regex.test(path);
}

/** The path filter for search_files: a glob, a folder, or both (the glob inside the folder). */
export function searchPathSource(include: string | undefined, folder: string | undefined): string | undefined {
  const dir = folder?.trim().replace(/^\.\/?/, "").replace(/\/+$/, "");
  const glob = include?.trim();
  if (!dir && !glob) return undefined;
  if (!glob) return `^${[...dir!].map(escape).join("")}/`;
  if (!dir) return globSource(glob);
  return globSource(`${dir}/${glob.includes("/") ? glob : `**/${glob}`}`);
}
