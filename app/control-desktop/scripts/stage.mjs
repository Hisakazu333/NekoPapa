#!/usr/bin/env node
/* ============================================================
   NekoPapa · Native Stage sidecar 准备脚本
   用法：
     node scripts/stage.mjs placeholder  创建零字节编译期占位（对齐 CI）
     node scripts/stage.mjs prepare      从外部产物复制真实 sidecar
   约定见 native-prebuilt/README.md 与 doc/architecture/build-and-test-gates.md。
   ============================================================ */
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(appDir, "..", "..");
const binariesDir = join(appDir, "src-tauri", "binaries");
const BINARY_BASE = "nekopapa-native-stage";

function hostTriple() {
  const out = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
  const match = out.match(/^host:\s*(\S+)$/m);
  if (!match) {
    throw new Error("无法从 `rustc -vV` 解析 host target triple");
  }
  return match[1];
}

/* placeholder 命名与 .github/workflows/ci.yml 保持一致：无 .exe 后缀。
   零字节文件只满足 tauri-build 的文件存在性检查，不是可运行产物。 */
function placeholderName(triple) {
  return `${BINARY_BASE}-${triple}`;
}

/* Tauri 在 Windows 上要求 sidecar 文件名带 .exe 后缀。 */
function sidecarName(triple) {
  return `${BINARY_BASE}-${triple}${process.platform === "win32" ? ".exe" : ""}`;
}

function makeExecutable(path) {
  if (process.platform !== "win32") {
    chmodSync(path, 0o755);
  }
}

function runPlaceholder() {
  const triple = hostTriple();
  mkdirSync(binariesDir, { recursive: true });
  /* CI 约定名（无后缀），与 .github/workflows/ci.yml 保持一致 */
  const target = join(binariesDir, placeholderName(triple));
  writeFileSync(target, "");
  makeExecutable(target);
  console.log(`[stage] placeholder 已创建: ${target}`);
  /* Windows 上 tauri-build 查找的是带 .exe 后缀的 sidecar 名，本地静态检查
     需要同名占位（CI 在 macOS 上运行，无需该文件） */
  if (process.platform === "win32") {
    const exeTarget = join(binariesDir, sidecarName(triple));
    writeFileSync(exeTarget, "");
    console.log(`[stage] placeholder 已创建: ${exeTarget}`);
  }
  console.log("[stage] 注意：零字节 placeholder 仅用于静态检查，不能运行。");
}

function runPrepare() {
  const triple = hostTriple();
  const envPath = process.env.NEKOPAPA_NATIVE_STAGE_BINARY;
  const exe = process.platform === "win32" ? ".exe" : "";
  const fallback = join(
    repoRoot,
    "native-prebuilt",
    "desktop",
    triple,
    `${BINARY_BASE}${exe}`,
  );

  let source = null;
  if (envPath) {
    if (!existsSync(envPath)) {
      throw new Error(
        `NEKOPAPA_NATIVE_STAGE_BINARY 指向的文件不存在: ${envPath}`,
      );
    }
    source = envPath;
  } else if (existsSync(fallback)) {
    source = fallback;
  } else {
    throw new Error(
      [
        "未找到 Native Stage 产物。提供方式：",
        "  方式一: export NEKOPAPA_NATIVE_STAGE_BINARY=/absolute/path/to/nekopapa-native-stage",
        `  方式二: 放入 native-prebuilt/desktop/${triple}/${BINARY_BASE}${exe}`,
        "详见 native-prebuilt/README.md。",
      ].join("\n"),
    );
  }

  if (statSync(source).size === 0) {
    throw new Error(`产物是零字节文件，拒绝作为 sidecar 使用: ${source}`);
  }

  mkdirSync(binariesDir, { recursive: true });
  const target = join(binariesDir, sidecarName(triple));
  copyFileSync(source, target);
  makeExecutable(target);
  console.log(`[stage] sidecar 已就位: ${source} -> ${target}`);
}

const mode = process.argv[2];
if (mode === "placeholder") {
  runPlaceholder();
} else if (mode === "prepare") {
  runPrepare();
} else {
  console.error("用法: node scripts/stage.mjs <placeholder|prepare>");
  process.exit(1);
}
