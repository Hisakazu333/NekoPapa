import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Compiles the interface plugin modules (tests/ui-plugins-tsconfig.json) to
 * a temporary folder and imports them; shared by tests/ui-plugin*.test.mjs.
 */
export async function compilePluginModules() {
  const output = mkdtempSync(join(tmpdir(), "nekopapa-ui-plugins-"));
  try {
    execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./ui-plugins-tsconfig.json", import.meta.url)), "--outDir", output]);
    writeFileSync(join(output, "package.json"), '{"type":"module"}');
    const folder = join(output, "app/plugins");
    for (const name of readdirSync(folder)) {
      const file = join(folder, name);
      writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+)(["'])(\.\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier}.js${quote}`));
    }
    const load = (name) => import(pathToFileURL(join(folder, `${name}.js`)));
    return {
      check: await load("plugin-manifest"),
      records: await load("plugin-records"),
      contributions: await load("plugin-contributions"),
      settings: await load("plugin-settings"),
    };
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}

export const memoryStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, String(value)); } };
};
