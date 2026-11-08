export type ApplicationLanguage = "zh-CN" | "en-US";

export const applicationLanguageKey = "nekopapa.ui-language.v1";
const legacyConfigurationKey = "nekopapa.settings.v1";

export interface LanguageStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function parseLanguage(value: unknown): ApplicationLanguage | undefined {
  return value === "zh-CN" || value === "en-US" ? value : undefined;
}

function legacyLanguage(source: string | null): ApplicationLanguage | undefined {
  if (!source) return undefined;
  try {
    const parsed: unknown = JSON.parse(source);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    const groups = (parsed as Record<string, unknown>).groups;
    if (typeof groups !== "object" || groups === null || Array.isArray(groups)) return undefined;
    const appearance = (groups as Record<string, unknown>).appearance;
    if (typeof appearance !== "object" || appearance === null || Array.isArray(appearance)) return undefined;
    return parseLanguage((appearance as Record<string, unknown>).language);
  } catch {
    return undefined;
  }
}

export class ApplicationLanguageStore {
  private current: ApplicationLanguage = "zh-CN";
  private readonly listeners = new Set<() => void>();
  private notice = "";

  constructor(private readonly storage: LanguageStorage) {
    try {
      const saved = storage.getItem(applicationLanguageKey);
      if (saved !== null) {
        this.current = parseLanguage(saved) ?? "zh-CN";
        return;
      }
      const previous = legacyLanguage(storage.getItem(legacyConfigurationKey));
      if (previous) {
        this.current = previous;
        try { storage.setItem(applicationLanguageKey, previous); }
        catch { this.notice = "语言已载入，但无法保存到本机。"; }
      }
    } catch {
      this.notice = "无法读取本机语言偏好。";
    }
  }

  get language() { return this.current; }
  get error() { return this.notice; }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setLanguage(language: ApplicationLanguage) {
    try { this.storage.setItem(applicationLanguageKey, language); }
    catch {
      this.notice = "无法保存界面语言；当前语言未更改。";
      return this.notice;
    }
    this.current = language;
    this.notice = "";
    this.publish();
    return null;
  }

  reload(value: string | null) {
    const next = value === null ? undefined : parseLanguage(value);
    const language = next ?? (value === null ? this.readLegacy() : undefined) ?? "zh-CN";
    if (language === this.current) return;
    this.current = language;
    this.notice = "";
    this.publish();
  }

  private readLegacy() {
    try { return legacyLanguage(this.storage.getItem(legacyConfigurationKey)); }
    catch { return undefined; }
  }

  private publish() {
    for (const listener of this.listeners) listener();
  }
}
