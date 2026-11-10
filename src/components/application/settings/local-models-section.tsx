import { useCallback, useEffect, useState } from "react";
import { CheckIcon, RefreshCwIcon } from "@/components/foundations/icons/app-icons";
import { LOCAL_RUNTIMES, localModelRecord, readLocalRuntime, type LocalModel, type LocalRuntime, type LocalRuntimeState } from "@/app/models/local-models";
import { connectionModelIds } from "@/app/models/model-connection-models";
import { probeLocalRuntimes } from "@/app/models/local-models-check";
import type { ConfigurationRecord } from "@/app/settings/configuration-types";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { useConfiguration } from "@/hooks/use-configuration";
import { cx } from "@/utils/cx";
import { SettingsCard, SettingsSectionLabel } from "./settings-rows";

type Scan = { kind: "checking"; last?: Map<string, LocalRuntimeState> } | { kind: "failed"; reason: string } | { kind: "done"; states: Map<string, LocalRuntimeState> };

const initials: Record<LocalRuntime["id"], string> = { ollama: "O", lmstudio: "LM", llamacpp: "L", vllm: "v", jan: "J" };
const sameRecord = (record: ConfigurationRecord, runtime: LocalRuntime, model: string) => {
  const target = localModelRecord(runtime, model);
  return record.values.endpoint === target.endpoint && connectionModelIds(record.values).includes(String(target.model));
};

/**
 * 本地模型: which local inference apps answer on this computer, as a row of
 * tiles, then the models each running one serves, each of which can be saved
 * as a 自定义 API record. Checked when the page opens and on 重新检测;
 * nothing is started, installed or downloaded.
 */
export function LocalModelsSection() {
  const { store, data, refresh } = useConfiguration();
  const [scan, setScan] = useState<Scan>({ kind: "checking" });
  const [notice, setNotice] = useState<{ tone: "status" | "alert"; text: string }>();

  const check = useCallback(async () => {
    // Keep the last result on screen while checking again, so tiles do not flash.
    setScan((current) => ({ kind: "checking", last: current.kind === "done" ? current.states : current.kind === "checking" ? current.last : undefined }));
    const result = await probeLocalRuntimes();
    if (!result.ok) { setScan({ kind: "failed", reason: result.reason }); return; }
    setScan({ kind: "done", states: new Map(LOCAL_RUNTIMES.map((runtime) => [runtime.id,
      readLocalRuntime(runtime, result.probes.find((probe) => probe.port === runtime.port && probe.path === runtime.path))])) });
  }, []);
  useEffect(() => { void check(); }, [check]);

  const add = (runtime: LocalRuntime, model: string) => {
    const failed = store.saveRecord("models", localModelRecord(runtime, model));
    refresh();
    if (failed) setNotice({ tone: "alert", text: Object.values(failed)[0] ?? "保存失败。" });
    else if (!store.storageAvailable) setNotice({ tone: "alert", text: store.notice || "本机存储暂不可用。" });
    else setNotice({ tone: "status", text: `已添加「${localModelRecord(runtime, model).name}」，可在下方自定义 API 中编辑。` });
  };

  const states = scan.kind === "done" ? scan.states : scan.kind === "checking" ? scan.last : undefined;
  const running = LOCAL_RUNTIMES.filter((runtime) => states?.get(runtime.id)?.kind === "running");
  const modelCount = running.reduce((sum, runtime) => sum + (states?.get(runtime.id) as { models: LocalModel[] }).models.length, 0);
  const unexpected = LOCAL_RUNTIMES.flatMap((runtime) => { const state = states?.get(runtime.id); return state?.kind === "unexpected" ? [{ runtime, reason: state.reason }] : []; });
  const summary = scan.kind === "failed" ? null
    : !states ? "正在检测本机服务…"
    : running.length === 0 ? "没有发现正在运行的本地模型服务"
    : `发现 ${running.length} 个服务，共 ${modelCount} 个模型`;

  return <section className="flex flex-col gap-2" aria-label="本地模型" aria-busy={scan.kind === "checking"}>
    <div className="flex items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <SettingsSectionLabel>本地模型</SettingsSectionLabel>
        <p className="px-3 text-body-2-regular text-text-tertiary">在这台电脑上运行的推理软件。只读取模型列表，不会启动、安装或下载模型。</p>
      </div>
      <Button variant="secondary" size="small" leadingIcon={RefreshCwIcon} disabled={scan.kind === "checking"} onClick={() => void check()}
        className={cx(scan.kind === "checking" && "[&_svg]:animate-spin")}>
        {scan.kind === "checking" ? "检测中" : "重新检测"}
      </Button>
    </div>

    <div className="flex flex-col gap-3 rounded-2xl bg-background-secondary-default p-3">
      {scan.kind === "failed"
        ? <p role="alert" className="text-body-2-regular text-text-secondary">{scan.reason}</p>
        : <div className="flex items-center gap-2">
          {!states && <SpinnerGlyph size="xs" className="text-foreground-icon-secondary" />}
          <p className="text-body-medium text-text-primary">{summary}</p>
          {states && running.length === 0 && <p className="text-body-2-regular text-text-tertiary">启动下面任意一款软件后，点“重新检测”。</p>}
        </div>}
      <ul aria-label="支持的本地推理软件" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {LOCAL_RUNTIMES.map((runtime) => <RuntimeTile key={runtime.id} runtime={runtime} state={states?.get(runtime.id)} />)}
      </ul>
      {unexpected.map(({ runtime, reason }) => <p key={runtime.id} className="text-body-2-regular text-text-secondary"><span translate="no">{runtime.name}</span>：{reason}</p>)}
    </div>

    {notice && <p role={notice.tone} className={cx("px-3 text-body-2-regular", notice.tone === "alert" ? "text-text-error-primary" : "text-text-secondary")}>{notice.text}</p>}

    {running.map((runtime) => {
      const models = (states?.get(runtime.id) as { models: LocalModel[] }).models;
      return <div key={runtime.id} className="flex flex-col gap-1.5">
        <SettingsSectionLabel><span translate="no">{runtime.name}</span> · {models.length} 个模型</SettingsSectionLabel>
        <SettingsCard>
          {models.length === 0 && <p className="py-3 pe-3 text-body-2-regular text-text-secondary">
            服务在运行，但还没有模型。{runtime.id === "ollama" ? "可以在终端运行 ollama pull 加模型名下载，例如 ollama pull llama3.2。" : "先在软件中下载或加载一个模型。"}
          </p>}
          {models.length > 0 && <ul aria-label={`${runtime.name} 的模型`}>
            {models.map((model) => {
              const saved = data.collections.models.some((record) => sameRecord(record, runtime, model.id));
              return <li key={model.id} className="flex min-h-12 items-center gap-3 border-b border-separator-border py-2 pe-2.5 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span translate="no" className="truncate font-mono text-body-2-regular text-text-primary">{model.id}</span>
                  {model.detail && <span className="text-caption-1-regular text-text-tertiary">{model.detail}</span>}
                </div>
                {saved
                  ? <span className="flex shrink-0 items-center gap-1 text-body-2-regular text-text-tertiary"><CheckIcon className="size-4" aria-hidden />已添加</span>
                  : <Button variant="secondary" size="small" onClick={() => add(runtime, model.id)} aria-label={`把 ${model.id} 添加为 API 配置`}>添加</Button>}
              </li>;
            })}
          </ul>}
        </SettingsCard>
      </div>;
    })}
    {running.length > 0 && <p className="px-3 text-body-2-regular text-text-tertiary">添加后保存为不需要密钥的“OpenAI 兼容接口”配置（http://127.0.0.1:端口/v1）。聊天服务目前还不读取这些配置。</p>}
  </section>;
}

/** One app: its mark, name and whether it answered, with the port it was looked for on. */
function RuntimeTile({ runtime, state }: { runtime: LocalRuntime; state?: LocalRuntimeState }) {
  const on = state?.kind === "running";
  return <li title={runtime.hint} className={cx(
    "flex min-w-0 flex-col gap-2 rounded-xl border p-2.5 transition-colors",
    on ? "border-border-button-default bg-background-primary-default" : "border-separator-border bg-background-secondary-default",
  )}>
    <div className="flex min-w-0 items-center gap-2">
      <Avatar size="xs" initials={initials[runtime.id]} />
      <span translate="no" className={cx("truncate text-body-2-medium", on ? "text-text-primary" : "text-text-secondary")}>{runtime.name}</span>
    </div>
    <div className="flex items-center justify-between gap-1">
      {!state ? <Chip variant="caption" color="soft">检测中</Chip>
        : on ? <Chip variant="caption" color="lime">运行中</Chip>
        : state.kind === "unexpected" ? <Chip variant="caption" color="yellow">无法识别</Chip>
        : <Chip variant="caption" color="neutral">未运行</Chip>}
      <span className="font-mono text-caption-1-regular text-text-tertiary">:{runtime.port}</span>
    </div>
  </li>;
}
