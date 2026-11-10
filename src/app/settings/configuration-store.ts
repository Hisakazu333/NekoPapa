import { configurationDefaults, validateConfiguration, validateFields, validateRecord, configurationSchemas } from "./configuration-contract";
import { configurationKey } from "./configuration-types";
import type { ConfigurationData, ConfigurationGroup, ConfigurationCollection, ConfigurationValues, ConfigurationStorage, ConfigurationRecord } from "./configuration-types";

export class ConfigurationStore {
  private current = configurationDefaults();
  private available = true;
  private recovery: string | null = null;
  private blocked = false;
  private removed?: { collection: ConfigurationCollection; record: ConfigurationRecord; index: number; models: string[] };
  notice = "";
  constructor(private storage: ConfigurationStorage = localStorage) {
    let raw: string | null;
    try { raw = storage.getItem(configurationKey); }
    catch {
      this.available = false;
      this.blocked = true;
      this.notice = "无法读取原始设置，暂不能覆盖。请重试保存。";
      return;
    }
    try {
      if (raw !== null) {
        const result = validateConfiguration(JSON.parse(raw));
        if (!result.ok) throw new Error("invalid configuration");
        this.current = result.value;
      }
    } catch {
      this.available = false;
      this.recovery = raw;
      if (this.recovery !== null) {
        try { storage.setItem(`${configurationKey}.recovery`, this.recovery); }
        catch { this.blocked = true; }
      }
      this.notice = this.blocked ? "原始设置尚未备份，暂不能覆盖。请重试保存或导出原始设置。" : "原始设置读取失败，已保留备份；当前使用默认值。";
    }
  }

  get data(): ConfigurationData { return structuredClone(this.current); }
  get storageAvailable(): boolean { return this.available; }
  get recoveryData(): string | null { return this.recovery; }
  get removedRecord() { return this.removed ? { collection: this.removed.collection, name: String(this.removed.record.values.name) } : undefined; }
  get previousBackup(): string | null { try { return this.storage.getItem(`${configurationKey}.previous`); } catch { return null; } }

  fields(group: ConfigurationGroup) {
    return configurationSchemas.find((schema) => schema.id === group)!.blocks.flatMap((block) => block.fields).map((field) => field.key === "modelId" ? {
      ...field, options: [["", group === "coding" ? "沿用 Agent 默认" : "暂不指定"] as const, ...this.current.collections.models.map((record) => [record.id, String(record.values.name)] as const)],
    } : field);
  }

  saveGroup(group: ConfigurationGroup, values: ConfigurationValues): Record<string, string> | undefined {
    const result = validateFields(this.fields(group), values, true);
    if (!result.ok) return result.errors;
    if (this.blocked) return { form: this.notice };
    this.current.groups[group] = result.value;
    this.persist();
    return undefined;
  }

  saveRecord(collection: ConfigurationCollection, values: ConfigurationValues, id?: string): Record<string, string> | undefined {
    const result = validateRecord(collection, values);
    if (!result.ok) return result.errors;
    if (this.blocked) return { form: this.notice };
    const records = this.current.collections[collection];
    const existing = id ? records.find((record) => record.id === id) : undefined;
    if (id && !existing) return { form: "这份配置已不存在，请重新打开列表。" };
    if (!id && records.length >= 100) return { form: "每类最多保存 100 份配置。" };
    if (existing) existing.values = result.value;
    else records.push({ id: `${collection}-${crypto.randomUUID()}`, values: result.value });
    this.persist();
    return undefined;
  }

  removeRecord(collection: ConfigurationCollection, id: string): boolean {
    if (this.blocked || !this.current.collections[collection].some((record) => record.id === id)) return false;
    const index = this.current.collections[collection].findIndex((record) => record.id === id);
    this.removed = { collection, record: structuredClone(this.current.collections[collection][index]), index, models: [String(this.current.groups.agent.modelId), String(this.current.groups.coding.modelId)] };
    this.current.collections[collection] = this.current.collections[collection].filter((record) => record.id !== id);
    if (collection === "models") for (const group of ["agent", "coding"] as const) if (this.current.groups[group].modelId === id) this.current.groups[group].modelId = "";
    this.persist();
    return true;
  }

  restoreRemoved(): boolean {
    const removed = this.removed;
    if (!removed || this.blocked || this.current.collections[removed.collection].some((record) => record.id === removed.record.id)) return false;
    this.current.collections[removed.collection].splice(Math.min(removed.index, this.current.collections[removed.collection].length), 0, removed.record);
    if (removed.collection === "models") ["agent", "coding"].forEach((group, index) => {
      const values = this.current.groups[group as "agent" | "coding"];
      if (!values.modelId && removed.models[index] === removed.record.id) values.modelId = removed.record.id;
    });
    this.removed = undefined;
    this.persist();
    return true;
  }

  replace(data: ConfigurationData): boolean {
    const result = validateConfiguration(data);
    if (!result.ok || this.blocked) return false;
    try { this.storage.setItem(`${configurationKey}.previous`, JSON.stringify(this.current)); }
    catch { this.notice = "无法保存替换前的备份，本次未替换设置。"; this.available = false; return false; }
    this.current = result.value;
    this.removed = undefined;
    this.persist();
    return true;
  }

  reload(source: string | null): boolean {
    if (!this.available) {
      this.notice = "其他窗口已更改设置；本窗口有未落盘的更改，请先重试保存。";
      return false;
    }
    try {
      const result = source === null ? { ok: true as const, value: configurationDefaults() } : validateConfiguration(JSON.parse(source));
      if (!result.ok) return false;
      this.current = result.value;
      this.removed = undefined;
      this.available = true;
      this.notice = "已同步其他窗口保存的设置。";
      return true;
    } catch { return false; }
  }

  persist(): boolean {
    try {
      if (this.blocked) {
        if (this.recovery !== null) this.storage.setItem(`${configurationKey}.recovery`, this.recovery);
        else {
          const source = this.storage.getItem(configurationKey);
          if (source !== null) {
            try {
              const result = validateConfiguration(JSON.parse(source));
              if (!result.ok) throw new Error();
              this.current = result.value;
            } catch { this.storage.setItem(`${configurationKey}.recovery`, source); this.recovery = source; }
          }
        }
        this.blocked = false;
      }
      this.storage.setItem(configurationKey, JSON.stringify(this.current));
      this.available = true;
      this.notice = "";
    } catch { this.available = false; this.notice = this.blocked ? "原始设置备份仍然失败，未覆盖源数据。" : "保存失败，更改仅在当前窗口保留。请重试保存。"; }
    return this.available;
  }
}
