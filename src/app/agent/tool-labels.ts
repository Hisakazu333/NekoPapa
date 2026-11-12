/**
 * The one-line title of a tool call in the transcript ("读取 src/app.ts"),
 * from what the model asked for. Unknown tools keep their own name.
 */

const field = (input: unknown, name: string) => {
  const value = input !== null && typeof input === "object" ? (input as Record<string, unknown>)[name] : undefined;
  return typeof value === "string" ? value : "";
};

const VERBS: Record<string, { running: string; done: string }> = {
  list_files: { running: "正在查看", done: "查看了" },
  read_file: { running: "正在读取", done: "读取了" },
  search_files: { running: "正在搜索", done: "搜索了" },
  write_file: { running: "正在写入", done: "写入了" },
  edit_file: { running: "正在修改", done: "修改了" },
  run_command: { running: "正在运行", done: "运行了" },
};

/** What the call acts on: a path, a quoted query or the command. */
export function toolSubject(name: string, input: unknown): string {
  if (name === "search_files") return field(input, "query") ? `“${field(input, "query")}”` : "";
  if (name === "run_command") return field(input, "command");
  if (name === "list_files") return field(input, "path") || "项目根目录";
  return field(input, "path");
}

export function toolTitle(name: string, input: unknown, finished: boolean): string {
  const verb = VERBS[name];
  if (!verb) return name;
  return `${finished ? verb.done : verb.running} ${toolSubject(name, input)}`.trim();
}

/** Calls that change the project and are approved by the user. */
export const isChangeTool = (name: string) => name === "write_file" || name === "edit_file" || name === "run_command";
