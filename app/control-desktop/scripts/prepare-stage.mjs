import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const controlDir = resolve(scriptDir, "..");
const repoRoot = resolve(controlDir, "../..");

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
const buildDir = join(repoRoot, "build", `stage-${hostTriple}`);
const executableName = process.platform === "win32"
  ? "openneko-live2d-stage.exe"
  : "openneko-live2d-stage";

run("cmake", [
  "-S", repoRoot,
  "-B", buildDir,
  "-G", "Ninja",
  "-DCMAKE_BUILD_TYPE=Release",
  "-DNNA_BUILD_APP=OFF",
  "-DNNA_BUILD_LIVE2D_STAGE=ON",
  "-DNNA_ENABLE_LIVE2D=ON",
]);
run("cmake", ["--build", buildDir, "--target", "openneko_live2d_stage"]);

const candidates = [
  join(buildDir, "bin", executableName),
  join(buildDir, "app", "live2d-stage", executableName),
  join(buildDir, "app", "live2d-stage", "Release", executableName),
];
const source = candidates.find((candidate) => existsSync(candidate));
if (!source) {
  throw new Error(`Native Stage output was not found in ${buildDir}`);
}

const binariesDir = join(controlDir, "src-tauri", "binaries");
mkdirSync(binariesDir, { recursive: true });
const destination = join(
  binariesDir,
  `openneko-live2d-stage-${hostTriple}${process.platform === "win32" ? ".exe" : ""}`,
);
copyFileSync(source, destination);
if (process.platform !== "win32") {
  chmodSync(destination, 0o755);
}
console.log(`Prepared Native Stage sidecar: ${destination}`);
