import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const output = mkdtempSync(join(tmpdir(), "nekopapa-tests-"));
const modules = {};
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("../tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  for (const name of readdirSync(output).filter((name) => name.endsWith(".js"))) {
    const path = join(output, name);
    writeFileSync(path, readFileSync(path, "utf8").replace(/(from\s+|import\s*)(["'])(\.\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`));
  }
  for (const name of ["state", "activity", "chrome", "feature-model", "sidebar-model", "companion-model"]) {
    if (readdirSync(output).includes(`${name}.js`)) modules[name] = await import(pathToFileURL(join(output, `${name}.js`)));
  }
} finally { rmSync(output, { recursive: true, force: true }); }
export const stateModule = modules.state;
export const activityModule = modules.activity;
export const chromeModule = modules.chrome;
export const featuresModule = modules["feature-model"];
export const sidebarModule = modules["sidebar-model"];
export const companionsModule = modules["companion-model"];
