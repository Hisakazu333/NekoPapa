import "./styles.css";
import { isTauri } from "@tauri-apps/api/core";
import { ShellController } from "./app/controller";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Application root is missing");

const native = isTauri();
root.classList.toggle("is-native", native);
root.classList.toggle("is-macos", /Mac/.test(navigator.platform));
new ShellController(root);

if (native) {
  root.addEventListener("dblclick", async (event) => {
    if (!(event.target as Element).matches("[data-tauri-drag-region]")) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  });
}
