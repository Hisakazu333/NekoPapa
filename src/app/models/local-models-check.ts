import { invoke, isTauri } from "@tauri-apps/api/core";
import { LOCAL_RUNTIMES, readLocalProbes, type LocalProbe } from "./local-models";

export type LocalProbeResult = { ok: true; probes: LocalProbe[] } | { ok: false; reason: string };

const targets = () => LOCAL_RUNTIMES.map(({ port, path }) => ({ port, path }));

/**
 * Asks this computer which local inference servers answer: the desktop host
 * through `probe_local_models`, the browser preview through its dev server.
 * When neither can check, says so instead of reporting servers as absent.
 */
export async function probeLocalRuntimes(): Promise<LocalProbeResult> {
  try {
    if (isTauri()) return { ok: true, probes: readLocalProbes(await invoke("probe_local_models", { targets: targets() })) };
    const response = await fetch("/api/local-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets: targets() }),
    });
    if (!response.ok) return { ok: false, reason: "当前页面不能检测本机服务。请在 NekoPapa 桌面应用或本地开发服务器中打开。" };
    return { ok: true, probes: readLocalProbes(await response.json()) };
  } catch {
    return { ok: false, reason: "当前页面不能检测本机服务。请在 NekoPapa 桌面应用或本地开发服务器中打开。" };
  }
}
