/** Top-level pages of the chat window, selected from the sidebar. Projects are not a page:
 *  they live in the sidebar's 项目 section, where folders group workbench chats. */
export type WorkspacePage = "chat" | "contacts" | "learning" | "knowledge";

/** Pages whose service lives in the NekoBuddy backend, which the client does not connect to yet. */
export type BackendWorkspacePage = Extract<WorkspacePage, "learning" | "knowledge">;
export const isBackendWorkspacePage = (page: WorkspacePage): page is BackendWorkspacePage =>
  page === "learning" || page === "knowledge";
