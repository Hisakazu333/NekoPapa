import { useState } from "react";
import { StatusDot } from "@/components/base/badges/status-dot";
import { DatabaseIcon } from "@/components/foundations/icons/app-icons";
import { useConfiguration } from "@/hooks/use-configuration";
import { probeLocalRuntimes, type LocalProbeResult } from "@/app/models/local-models-check";
import { LOCAL_RUNTIMES, readLocalRuntime } from "@/app/models/local-models";
import { WorkPanelRow, WorkPanelSection } from "./work-panel-section";

/** 连接器 ›: how many MCP services and connectors are saved; opens their settings. */
export function WorkPanelConnections({ onManage }: { onManage: () => void }) {
  const { data } = useConfiguration();
  const count = data.collections.extensions.filter(({ values }) => values.kind === "mcp" || values.kind === "connector").length;
  return <WorkPanelSection title="连接器" onPress={onManage} trailing={count ? `${count} 项已保存 · 未连接` : "未配置"} />;
}

/**
 * 服务器: local model servers answering on their default ports. Reading the
 * ports is a request to this computer, so it runs when asked; the rows are
 * what the last check returned.
 */
export function WorkPanelServers() {
  const [result, setResult] = useState<LocalProbeResult>();
  const [checking, setChecking] = useState(false);
  const detected = result?.ok ? LOCAL_RUNTIMES.flatMap((runtime) => {
    const state = readLocalRuntime(runtime, result.probes.find(({ port, path }) => port === runtime.port && path === runtime.path));
    return state.kind === "running" ? [{ runtime, count: state.models.length }] : [];
  }) : [];
  const check = async () => {
    setChecking(true);
    try { setResult(await probeLocalRuntimes()); } finally { setChecking(false); }
  };
  const action = <button type="button" disabled={checking} onClick={() => void check()}
    className="cursor-pointer rounded-md px-1.5 py-0.5 text-caption-1-medium text-text-secondary outline-none hover:bg-background-primary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-default disabled:opacity-60">
    {checking ? "检测中…" : result ? "重新检测" : "检测"}
  </button>;

  return <WorkPanelSection title="服务器" trailing={action}>
    {detected.length > 0
      ? <ul aria-label="检测到的本地模型服务" className="flex flex-col">
        {detected.map(({ runtime, count }) => <WorkPanelRow key={runtime.id} icon={DatabaseIcon}
          label={runtime.name} end={<><span translate="no" className="tabular-nums">localhost:{runtime.port}</span><StatusDot color="green" /></>}
          detail={`${count} 个模型`} />)}
      </ul>
      : <p role="status" className="text-caption-1-regular text-text-tertiary">
        {checking ? "正在读取默认端口上的模型列表…"
          : result?.ok ? "默认端口上没有本地模型服务响应。"
            : result?.reason ?? "检测 Ollama、LM Studio 等本地推理服务。"}
      </p>}
  </WorkPanelSection>;
}
