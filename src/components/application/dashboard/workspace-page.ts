/** Top-level pages of the chat window, selected from the sidebar. Projects are not a page:
 *  they live in the sidebar's 项目 section, where folders group workbench chats. */
export type WorkspacePage = "chat" | "contacts" | "learning" | "knowledge" | "space" | "cabin";

/**
 * Pages that cannot work yet and only state why: learning and knowledge wait
 * for the NekoBuddy backend, the cabin remains a planned experience.
 */
export type PendingWorkspacePage = Extract<WorkspacePage, "learning" | "knowledge" | "cabin">;
export const isPendingWorkspacePage = (page: WorkspacePage): page is PendingWorkspacePage =>
  page === "learning" || page === "knowledge" || page === "cabin";
