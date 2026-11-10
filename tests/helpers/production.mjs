import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const output = mkdtempSync(join(tmpdir(), "nekopapa-tests-"));
const modules = {};
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("../tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
  const files = new Map();
  for (const path of walk(output).filter((path) => path.endsWith(".js"))) {
    const name = basename(path, ".js");
    if (files.has(name)) throw new Error(`Ambiguous test module: ${name}`);
    files.set(name, path);
    writeFileSync(path, readFileSync(path, "utf8").replace(/(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`));
  }
  for (const name of ["state", "activity", "chrome", "feature-model", "sidebar-model", "companion-model", "companion-conversation", "contacts-store", "sidebar-query", "tab-model", "settings-model", "settings-preferences", "settings-draft-state", "configuration-store", "configuration-contract", "configuration-types", "cordis-plugins", "local-profile", "cloud-account-contract", "settings-usage-view", "settings-account-view"]) {
    const path = files.get(name);
    if (!path) throw new Error(`Missing test module: ${name}`);
    modules[name] = await import(pathToFileURL(path));
  }
} finally { rmSync(output, { recursive: true, force: true }); }
export const stateModule = modules.state;
export const activityModule = modules.activity;
export const chromeModule = modules.chrome;
export const featuresModule = modules["feature-model"];
export const sidebarModule = modules["sidebar-model"];
export const companionsModule = modules["companion-model"];
export const contactsStoreModule = modules["contacts-store"];
export const sidebarQueryModule = modules["sidebar-query"];
export const tabModule = modules["tab-model"];
export const settingsModule = modules["settings-model"];
export const settingsPreferencesModule = modules["settings-preferences"];
export const settingsDraftStateModule = modules["settings-draft-state"];
export const configurationStoreModule = modules["configuration-store"];
export const configurationContractModule = modules["configuration-contract"];
export const configurationTypesModule = modules["configuration-types"];
export const cordisPluginsModule = modules["cordis-plugins"];
export const localProfileModule = modules["local-profile"];
export const cloudAccountContractModule = modules["cloud-account-contract"];
export const settingsUsageViewModule = modules["settings-usage-view"];
export const settingsAccountViewModule = modules["settings-account-view"];
export const companionConversationModule = modules["companion-conversation"];
