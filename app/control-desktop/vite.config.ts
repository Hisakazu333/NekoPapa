import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri 约定：固定端口、strictPort、不在清屏（保留 tauri CLI 输出）
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2022",
  },
});
