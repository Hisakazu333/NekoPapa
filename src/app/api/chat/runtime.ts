/**
 * Where the chat handlers run. The dev server reads its own process
 * environment; the desktop app answers from its host, which keeps every key
 * on the Rust side and puts it into the outgoing request itself.
 */
export interface ChatRuntime {
  /** Non-secret configuration (AI_PROVIDER, AI_BASE_URL, CHAT_MODEL) and, for
   *  the environment provider, the key or a stand-in the host replaces. */
  env: (name: string) => string | undefined;
  /** The key a saved profile's variable names, or a stand-in; undefined when unset. */
  credential: (name: string) => string | undefined;
  /** The HTTP client model requests go through; the platform fetch when absent. */
  fetch?: typeof globalThis.fetch;
}
