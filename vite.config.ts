import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { GET, POST, TEST } from "./src/app/api/chat/route";
import { boarduiChatApi } from "./scripts/boardui-chat-api";
import { projectFolderApi } from "./scripts/project-folder-api";
import { localModelsApi } from "./scripts/local-models-api";
import { projectWorkspaceApi } from "./scripts/project-workspace-api";
import { skillDiscoveryApi } from "./scripts/skill-discovery-api";
import { pluginManifestApi } from "./scripts/plugin-manifest-api";

// The official runtime reads these server variables; none are defined in the client bundle.
const runtimeVariables = [
  "AI_API_KEY", "AI_PROVIDER", "AI_BASE_URL", "CHAT_MODEL", "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY", "OPENAI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY",
  "AI_GATEWAY_API_KEY", "GROQ_API_KEY", "XAI_API_KEY", "MISTRAL_API_KEY", "DEEPSEEK_API_KEY",
];

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  for (const name of runtimeVariables) {
    if (process.env[name] === undefined && environment[name] !== undefined) process.env[name] = environment[name];
  }
  return {
    plugins: [tailwindcss(), boarduiChatApi({ GET, POST, TEST }), projectFolderApi(), localModelsApi(), projectWorkspaceApi(), skillDiscoveryApi(), pluginManifestApi()],
    resolve: { alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    } },
    clearScreen: false,
    server: {
      host: "127.0.0.1",
      port: 1420,
      strictPort: true,
      watch: { ignored: ["**/src-tauri/**", "**/.local/**"] },
    },
    preview: { host: "127.0.0.1", port: 1421, strictPort: true },
    build: {
      target: "es2022",
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          chat: fileURLToPath(new URL("./chat.html", import.meta.url)),
        },
      },
    },
  };
});
