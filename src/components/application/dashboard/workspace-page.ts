/** Top-level pages of the chat window, selected from the sidebar. Projects are not a page:
 *  they live in the sidebar's 项目 section, where folders group workbench chats. */
export type WorkspacePage = "chat" | "contacts" | "learning" | "knowledge" | "space" | "cabin";

/** Learning and knowledge still depend on the NekoBuddy backend. */
export type PendingWorkspacePage = Extract<WorkspacePage, "learning" | "knowledge">;
export const isPendingWorkspacePage = (page: WorkspacePage): page is PendingWorkspacePage =>
  page === "learning" || page === "knowledge";
