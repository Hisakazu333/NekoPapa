import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const controlDir = resolve(scriptDir, "..");
const repoRoot = resolve(controlDir, "../..");
const placeholderOnly = process.argv.includes("--placeholder");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    throw new Error(`${command} failed: ${detail}`);
  }
  return result.stdout?.trim() ?? "";
}

const rustVersion = run("rustc", ["-vV"], { capture: true });
const hostLine = rustVersion.split("\n").find((line) => line.startsWith("host: "));
if (!hostLine) {
  throw new Error("Unable to resolve the Rust host triple");
}

const hostTriple = process.env.TAURI_ENV_TARGET_TRIPLE || hostLine.slice("host: ".length).trim();
const executableName = process.platform === "win32"
  ? "nekopapa-native-stage.exe"
  : "nekopapa-native-stage";

const binariesDir = join(controlDir, "src-tauri", "binaries");
mkdirSync(binariesDir, { recursive: true });
const destination = join(
  binariesDir,
  `nekopapa-native-stage-${hostTriple}${process.platform === "win32" ? ".exe" : ""}`,
);

if (placeholderOnly) {
  if (!existsSync(destination)) {
    closeSync(openSync(destination, "w"));
  }
  if (process.platform !== "win32") {
    chmodSync(destination, 0o755);
  }
  console.warn(`Prepared compile-time-only Native Stage placeholder: ${destination}`);
  process.exit(0);
}

const configuredSource = process.env.NEKOPAPA_NATIVE_STAGE_BINARY?.trim();
const defaultSource = join(
  repoRoot,
  "native-prebuilt",
  "desktop",
  hostTriple,
  executableName,
);
const source = configuredSource ? resolve(configuredSource) : defaultSource;

if (!existsSync(source) || !statSync(source).isFile() || statSync(source).size === 0) {
  throw new Error([
    `A compatible Native Stage binary was not found for ${hostTriple}.`,
    `Expected: ${defaultSource}`,
    "Or set NEKOPAPA_NATIVE_STAGE_BINARY to an absolute prebuilt binary path.",
    "The Native Stage implementation is maintained outside this repository.",
  ].join("\n"));
}

if (resolve(source) !== resolve(destination)) {
  copyFileSync(source, destination);
}
if (process.platform !== "win32") {
  chmodSync(destination, 0o755);
}
console.log(`Prepared Native Stage sidecar: ${destination}`);
