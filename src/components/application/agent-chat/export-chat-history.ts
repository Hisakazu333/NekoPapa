import type { StoredThread } from "./thread-storage";

/** Download the local chat history without sending it to a service. */
export function downloadChatThreads(threads: StoredThread[]) {
  if (threads.length === 0) return;
  const blob = new Blob([JSON.stringify(threads, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "nekopapa-chats.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
