import "./styles.css";
import "./app/drag.css";
import "./app/chrome.css";
import "./app/sidebar.css";
import "./app/companion.css";
import "./app/features.css";
import { isTauri } from "@tauri-apps/api/core";
import { ShellController } from "./app/controller";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Application root is missing");

const native = isTauri();
root.classList.toggle("is-native", native);
root.classList.toggle("is-macos", /Mac/.test(navigator.platform));
new ShellController(root);
