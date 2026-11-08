import { useEffect, useRef, useState } from "react";
import { RiDownloadLine, RiUploadLine } from "@remixicon/react";
import { exportConfiguration, parseConfigurationBackup, validateConfiguration } from "@/app/configuration-contract";
import type { ConfigurationData } from "@/app/configuration-types";
import { Button } from "@/components/base/buttons/button";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { useConfiguration } from "@/hooks/use-configuration";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";

type Feedback = { text: string; error?: boolean };
const modeLabels: Record<string, string> = { system: "跟随系统", light: "浅色", dark: "深色" };

function download(source: string, kind: string): void {
  const url = URL.createObjectURL(new Blob([source], { type: "application/json" }));
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = `nekopapa-${kind}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function DataSettingsPanel({ onClose }: { onClose: () => void }) {
  const { store, data, storageAvailable, notice, refresh } = useConfiguration();
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  const [preview, setPreview] = useState<ConfigurationData>();
  const [filename, setFilename] = useState("");
  const [reading, setReading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();

  useEffect(() => () => { selection.current++; }, []);

  const cancelPreview = () => {
    selection.current++;
    setPreview(undefined);
    setFilename("");
    setReading(false);
    setFeedback(undefined);
  };

  const read = async (file?: File) => {
    if (!file) return;
    const token = ++selection.current;
    setPreview(undefined);
    setFilename(file.name);
    setReading(true);
    setFeedback(undefined);
    try {
      if (file.size > 1024 * 1024) throw new Error("设置备份不能超过 1 MiB。");
      const result = parseConfigurationBackup(await file.text());
      if (token !== selection.current) return;
      if (!result.ok) throw new Error(Object.values(result.errors)[0]);
      setPreview(result.value);
    } catch (error) {
      if (token === selection.current) setFeedback({ text: error instanceof Error ? error.message : "无法读取文件，请重新选择。", error: true });
    } finally {
      if (token === selection.current) setReading(false);
    }
  };

  const applyImport = () => {
    if (!preview) return;
    // replace() owns validation and the required backup before any replacement.
    if (!store.replace(preview)) {
      setFeedback({ text: store.notice || "导入失败，未替换设置。", error: true });
    } else {
      setPreview(undefined);
      setFilename("");
      setFeedback(store.storageAvailable
        ? { text: "已导入设置，替换前的配置已保留备份。" }
        : { text: "设置已在当前窗口替换，但未能保存到本机。请重试保存。", error: true });
    }
    refresh();
  };

  const retry = () => {
    const saved = store.persist();
    refresh();
    setFeedback({ text: saved ? "设置已保存到本机。" : store.notice, error: !saved });
  };

  const exportBackup = (kind: "settings" | "settings-previous" | "settings-recovery") => {
    try {
      let source: string;
      if (kind === "settings") source = exportConfiguration(store.data);
      else if (kind === "settings-recovery") {
        if (store.recoveryData === null) throw new Error("没有损坏的原始设置需要导出。");
        source = store.recoveryData;
      } else {
        const previous = store.previousBackup;
        if (previous === null) throw new Error("尚无替换前备份。首次导入设置时会自动生成。");
        const result = validateConfiguration(JSON.parse(previous));
        if (!result.ok) throw new Error("替换前备份无法读取，请先检查本机存储。");
        source = exportConfiguration(result.value);
      }
      download(source, kind);
      setFeedback({ text: "已生成下载文件，请在浏览器或客户端中完成保存。" });
    } catch (error) {
      setFeedback({ text: error instanceof SyntaxError ? "替换前备份无法读取，请先检查本机存储。" : error instanceof Error ? error.message : "导出失败，请重试。", error: true });
    }
  };

  return (
    <>
      <ModalBody>
        <div className="flex flex-col gap-5">
          <p className="text-body-regular text-text-secondary">
            设置保存在当前设备。备份包含本机资料、外观、执行默认值和模型、工具、设备、钩子配置；不包含聊天历史、附件或旧工作台索引。
          </p>
          <div className="flex flex-col gap-2">
            <SettingsSectionLabel>导出与备份</SettingsSectionLabel>
            <SettingsCard>
              <SettingsRow label="当前设置" description={`${(new TextEncoder().encode(JSON.stringify(data)).length / 1024).toFixed(1)} KiB · NekoPapa 设置格式版本 1`}>
                <Button variant="secondary" size="small" leadingIcon={RiDownloadLine} onClick={() => exportBackup("settings")}>导出设置</Button>
              </SettingsRow>
              <SettingsRow label="替换前的设置" description="导入确认前自动保留一份备份，可导出后重新导入。">
                <Button variant="secondary" size="small" onClick={() => exportBackup("settings-previous")}>导出上次备份</Button>
              </SettingsRow>
              {store.recoveryData !== null && (
                <SettingsRow label="原始设置恢复" description="导出读取失败时保留的原文，供人工检查。">
                  <Button variant="secondary" size="small" onClick={() => exportBackup("settings-recovery")}>导出原始设置</Button>
                </SettingsRow>
              )}
            </SettingsCard>
            <p className="px-3 text-body-2-regular text-text-tertiary">
              凭据仅保存环境变量名或身份文件路径；备份不包含实际 API Key、密码或私钥。备份可能包含自定义指令和服务地址，请妥善保管。
            </p>
          </div>

          <section className="flex flex-col gap-3" aria-labelledby="configuration-import-heading">
            <h3 id="configuration-import-heading" className="px-3 text-body-medium text-text-primary">从设置备份导入</h3>
            <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border-button-default p-4">
              <p className="text-body-regular text-text-secondary">选择 NekoPapa 导出的 JSON 文件，先校验和预览，再确认替换。最大 1 MiB。</p>
              <input ref={input} type="file" accept="application/json,.json" aria-label="选择设置备份文件" className="hidden" onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void read(file);
              }} />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="small" leadingIcon={RiUploadLine} onClick={() => input.current?.click()}>选择设置文件</Button>
                {filename && <span className="min-w-0 break-all text-body-2-regular text-text-tertiary">{filename}</span>}
              </div>
              {reading && <p role="status">正在读取并校验…</p>}
            </div>
            {preview && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border-focus-ring bg-background-secondary-default p-4">
                <h4 className="text-body-medium text-text-primary">导入预览</h4>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-regular">
                  <dt>本机名称</dt><dd className="break-all text-text-primary">{String(preview.groups.profile.name)}</dd>
                  <dt>主题</dt><dd className="text-text-primary">{modeLabels[String(preview.groups.appearance.mode)]}</dd>
                  <dt>模型与工具</dt><dd className="text-text-primary">{preview.collections.models.length} 个模型 · {preview.collections.extensions.length} 个工具</dd>
                  <dt>设备与钩子</dt><dd className="text-text-primary">{preview.collections.connections.length} 个设备 · {preview.collections.hooks.length} 个钩子</dd>
                </dl>
                <p className="text-body-2-regular text-text-secondary">确认后替换全部本机设置与配置列表，并备份替换前的配置。聊天历史、附件和旧工作台内容保持原样；不会连接服务或执行命令。</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="small" onClick={cancelPreview}>取消导入</Button>
                  <Button size="small" onClick={applyImport}>确认替换本机设置</Button>
                </div>
              </div>
            )}
          </section>

          {!storageAvailable && <div className="flex flex-wrap items-center gap-2 rounded-xl bg-background-secondary-default p-3">
            <p className="min-w-0 flex-1 text-body-2-regular text-text-error-primary" role="alert">{notice || "设置尚未保存到本机。"}</p>
            <Button variant="secondary" size="small" onClick={retry}>重试保存</Button>
          </div>}
          {feedback && <p role={feedback.error ? "alert" : "status"} className={feedback.error ? "text-body-regular text-text-error-primary" : "text-body-regular text-text-primary"}>{feedback.text}</p>}
        </div>
      </ModalBody>
      <ModalFooter><Button variant="secondary" onClick={onClose}>关闭</Button></ModalFooter>
    </>
  );
}
