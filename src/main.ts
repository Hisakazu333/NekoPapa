import { createElement, Fragment } from "react";
import { desktopToolWindow, ISLAND_WINDOW, PET_WINDOW } from "@/app/desktop/desktop-tools";
import { ScreenIsland } from "@/components/application/desktop-tools/screen-island";
import { ScreenCapturePermissionNotice } from "@/components/application/desktop-tools/screen-capture-permission-notice";
import { DesktopPetWindow } from "@/components/application/desktop-tools/desktop-pet-window";
import { createRoot } from "react-dom/client";
import { AgentChat } from "@/components/application/agent-chat/agent-chat";
import "./styles/globals.css";
import "./platform/fonts.css";
import { ConfiguredTheme } from "./platform/configured-theme";
import { WorkspaceSettingsProvider } from "@/components/application/settings/workspace-settings";
import { AccountPageProvider } from "@/components/application/account/account-page-provider";
import { ApplicationLanguageProvider } from "@/components/application/language/application-language";
import { Toaster } from "@/components/base/toast/toast";

const root = document.getElementById("app");
if (!root) throw new Error("Application root is missing");

const renderer = createRoot(root);
const windowLabel = desktopToolWindow();
if (windowLabel === ISLAND_WINDOW || windowLabel === PET_WINDOW) {
  document.documentElement.classList.add("desktop-tool-window");
  renderer.render(createElement(Fragment, null, createElement(ConfiguredTheme),
    windowLabel === ISLAND_WINDOW ? createElement(ScreenIsland) : createElement(DesktopPetWindow)));
} else renderer.render(createElement(AccountPageProvider, null,
  createElement(ApplicationLanguageProvider, null,
    createElement(WorkspaceSettingsProvider, null,
      createElement(Fragment, null,
        createElement(ConfiguredTheme),
        createElement(AgentChat),
        createElement(ScreenCapturePermissionNotice),
        createElement(Toaster, { "aria-label": "通知", closeLabel: "关闭通知" }))))));
