/** Top-level pages of the chat window, selected from the sidebar. */
export type WorkspacePage = "chat" | "contacts" | "learning" | "knowledge" | "projects";

/** Pages whose service lives in the NekoBuddy backend, which the client does not connect to yet. */
export type BackendWorkspacePage = Extract<WorkspacePage, "learning" | "knowledge" | "projects">;
export const isBackendWorkspacePage = (page: WorkspacePage): page is BackendWorkspacePage =>
  page === "learning" || page === "knowledge" || page === "projects";
