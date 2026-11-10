import { DefaultChatTransport } from "ai";
import { chatFetch } from "./desktop-chat-runtime";

/** Every chat screen's transport: `/api/chat`, answered in the desktop app by its own runtime. */
export const createChatTransport = () => new DefaultChatTransport({ api: "/api/chat", fetch: chatFetch });
