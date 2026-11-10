import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { StatusDot } from "@/components/base/badges/status-dot";
import { DatabaseIcon } from "@/components/foundations/icons/app-icons";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { useConfiguration } from "@/hooks/use-configuration";
import { probeLocalRuntimes, type LocalProbeResult } from "@/app/local-models-check";
import { LOCAL_RUNTIMES, readLocalRuntime } from "@/app/local-models";
import { WorkPanelSection } from "./work-panel-section";

export function WorkPanelConnections({ onManage }: { onManage?: () => void }) {
  const { data } = useConfiguration();
  const openSettings = useWorkspaceSettings();
  const records = data.collections.extensions.filter(({ values }) => values.kind === "mcp" || values.kind === "connector");
  return <WorkPanelSection title="连接器" summary={records.length ? `${records.length} 项已配置` : "未配置"}>
    <div className="flex flex-col gap-2">
      {records.length > 0 && <ul aria-label="已配置的连接器" className="max-h-48 overflow-y-auto">
        {records.map(({ id, values }) => <li key={id} className="flex items-baseline justify-between gap-2 border-b border-separator-border py-1.5 last:border-0">
          <span translate="no" title={String(values.name)} className="min-w-0 truncate text-body-2-regular text-text-primary">{String(values.name)}</span>
          <span className="shrink-0 text-caption-1-regular text-text-secondary">{values.kind === "mcp" ? "MCP 服务" : "连接器"}</span>
        </li>)}
      </ul>}
      <p className="text-body-2-regular text-text-secondary">
        {records.length ? "这些是本机保存的配置。执行层接入后才会建立连接。" : "还没有保存 MCP 服务或连接器。"}
      </p>
      <Button size="small" variant="secondary" className="self-start" onClick={onManage ?? (() => openSettings("tools"))}>管理连接器</Button>
    </div>
  </WorkPanelSection>;
}

export function WorkPanelServers() {
  const [result, setResult] = useState<LocalProbeResult>();
  const [checking, setChecking] = useState(false);
  const detected = result?.ok ? LOCAL_RUNTIMES.flatMap((runtime) => {
    const state = readLocalRuntime(runtime, result.probes.find(({ port, path }) => port === runtime.port && path === runtime.path));
    return state.kind === "running" ? [{ runtime, count: state.models.length }] : [];
  }) : [];
  const check = async () => {
    setChecking(true);
    setResult(await probeLocalRuntimes());
    setChecking(false);
  };
  const summary = checking ? "检测中…" : result?.ok ? `${detected.length} 个响应` : result ? "无法检测" : "未检测";
  return <WorkPanelSection title="本地模型服务器" summary={summary}>
    <div className="flex flex-col gap-2">
      {detected.length > 0 && <ul aria-label="检测到的本地模型服务" className="flex flex-col gap-1">
        {detected.map(({ runtime, count }) => <li key={runtime.id} className="flex items-center gap-2 rounded-lg bg-background-secondary-default px-2 py-1.5">
          <DatabaseIcon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
          <span className="min-w-0 flex-1 text-body-2-regular text-text-primary" translate="no">127.0.0.1:{runtime.port}</span>
          <span className="shrink-0 text-caption-1-regular text-text-secondary">{count} 个模型</span>
          <StatusDot color="green" />
        </li>)}
      </ul>}
      <p role="status" className="text-body-2-regular text-text-secondary">
        {checking ? "正在读取默认端口上的模型列表…" : result?.ok
          ? detected.length ? "上面是最近一次检测返回的模型列表。" : "默认端口上没有返回可识别的模型列表。"
          : result?.reason ?? "检测 Ollama 等本地推理服务是否能返回模型列表。"}
      </p>
      <Button size="small" variant="secondary" className="self-start" disabled={checking} onClick={() => void check()}>
        {result ? "重新检测" : "检测本地模型"}
      </Button>
    </div>
  </WorkPanelSection>;
}
