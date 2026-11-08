import { createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { AgentChat } from "@/components/application/agent-chat/agent-chat";
import "./styles/globals.css";
import "./platform/fonts.css";
import { ConfiguredTheme } from "./platform/configured-theme";
import { WorkspaceSettingsProvider } from "@/components/application/settings/workspace-settings";
import { AccountPageProvider } from "@/components/application/account/account-page-provider";
import { ApplicationLanguageProvider } from "@/components/application/language/application-language";

const root = document.getElementById("app");
if (!root) throw new Error("Application root is missing");

createRoot(root).render(createElement(AccountPageProvider, null,
  createElement(ApplicationLanguageProvider, null,
    createElement(WorkspaceSettingsProvider, null,
      createElement(Fragment, null, createElement(ConfiguredTheme), createElement(AgentChat))))));
