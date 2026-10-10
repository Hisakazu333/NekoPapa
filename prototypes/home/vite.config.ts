import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  publicDir: `${projectRoot}public`,
  clearScreen: false,
  server: { host: "127.0.0.1", port: 1433, strictPort: true, fs: { allow: [projectRoot] }, watch: { ignored: ["**/.local/**", "**/src-tauri/**"] } },
  preview: { host: "127.0.0.1", port: 1434, strictPort: true },
  build: { outDir: `${projectRoot}.local/home-preview-build`, emptyOutDir: true, target: "es2022" },
});
