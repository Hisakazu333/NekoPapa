import { collectionSchemas } from "@/app/configuration-contract";
import type { ConfigurationCollection, ConfigurationData, ConfigurationRecord } from "@/app/configuration-types";
import type { ChipColor } from "@/components/base/badges/chip";

/** How one saved record reads in a settings list row. */
export interface RecordPresentation { initial: string; color: ChipColor; chips: string[]; summary: string; detail: string }

const kindColors: Record<string, ChipColor> = { mcp: "purple", connector: "cyan", skill: "yellow" };

function endpointHost(endpoint: string) {
  try { return new URL(endpoint).host; } catch { return endpoint; }
}

export function presentRecord(collection: ConfigurationCollection, record: ConfigurationRecord, groups: ConfigurationData["groups"]): RecordPresentation {
  const fields = collectionSchemas[collection].fields;
  const value = (key: string) => String(record.values[key] ?? "");
  const option = (key: string) => fields.find((field) => field.key === key)?.options?.find(([id]) => id === record.values[key])?.[1] ?? "";
  const initial = Array.from(value("name").trim())[0]?.toLocaleUpperCase() ?? "?";
  if (collection === "models") {
    const role = groups.agent?.modelId === record.id ? "通用 Agent 默认" : groups.coding?.modelId === record.id ? "Coding 默认" : "";
    return {
      initial, color: "blue", chips: [option("provider"), ...(role ? ["默认使用"] : [])],
      summary: `${value("model")} · ${endpointHost(value("endpoint"))}`,
      detail: [role || "未设为默认", value("environment") && `凭据引用 ${value("environment")}`].filter(Boolean).join(" · "),
    };
  }
  if (collection === "extensions") {
    const skill = value("kind") === "skill";
    return {
      initial, color: kindColors[value("kind")] ?? "neutral", chips: skill ? [] : [option("kind"), option("transport")],
      summary: value("transport") === "http" ? value("endpoint") : value("command"),
      detail: skill ? "已保存目录 · 技能加载尚未接入" : "已保存配置 · 工具运行时尚未接入",
    };
  }
  if (collection === "plugins") {
    const id = value("instanceId");
    return {
      initial, color: "blue", chips: [option("source"), ...(record.values.enabled === false ? ["已停用"] : [])],
      summary: value("module"),
      detail: [id && `实例 ID ${id}`, "插件加载尚未接入"].filter(Boolean).join(" · "),
    };
  }
  if (collection === "connections") {
    return {
      initial, color: "lime", chips: ["SSH"],
      summary: `${value("username")}@${value("host")}:${value("port")}`,
      detail: `身份文件 ${value("identity") || "未指定"} · 未建立连接`,
    };
  }
  return {
    initial, color: "orange", chips: [option("event")],
    summary: value("command"),
    detail: `超时 ${value("timeout")} 秒 · 钩子执行器尚未接入`,
  };
}
