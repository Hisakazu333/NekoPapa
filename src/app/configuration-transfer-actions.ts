import { configurationDefaults, parseConfigurationBackup, exportConfiguration } from "./configuration-contract";
import type { ConfigurationData } from "./configuration-types";
import type { ConfigurationStore } from "./configuration-store";
import type { WorkspaceStore } from "./state";
import type { ShellOverlays } from "./overlays";

interface TransferHost { render(focus?: string): void; changed(message: string, focus?: string): void; message(text: string): void }

export class ConfigurationTransferActions {
  preview?: ConfigurationData;
  error?: string;
  private selection = 0;
  constructor(private store: ConfigurationStore, private workspace: WorkspaceStore, private overlays: ShellOverlays, private host: TransferHost) {}

  async read(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    const token = ++this.selection;
    this.preview = undefined;
    this.error = undefined;
    try {
      if (file.size > 1024 * 1024) throw new Error("设置备份不能超过 1 MiB。");
      const result = parseConfigurationBackup(await file.text());
      if (token !== this.selection) return;
      if (result.ok) this.preview = result.value;
      else this.error = Object.values(result.errors)[0];
    } catch (error) { if (token === this.selection) this.error = error instanceof Error ? error.message : "无法读取文件，请重新选择。"; }
    if (token === this.selection) this.host.render("configuration-apply-import");
  }

  cancel(): void { this.selection++; this.preview = undefined; this.error = undefined; this.host.render("settings-heading"); }

  apply(): void {
    if (!this.preview) return;
    const snapshot = this.preview;
    this.confirm("导入设置", "将替换当前本机设置和配置列表，同时保存替换前的备份。未保存的设置草稿会取消，工作台内容保持原样。", () => {
      if (!this.store.replace(snapshot)) { this.host.message(this.store.notice || "导入失败，未替换设置。"); return; }
      this.preview = undefined;
      this.host.changed("已导入设置。", "settings-heading");
    });
  }

  reset(): void {
    this.confirm("恢复默认设置", "清空模型、工具、设备和钩子配置，恢复个人、外观及执行默认值。会保留替换前备份和所有工作台内容。", () => {
      if (!this.store.replace(configurationDefaults())) { this.host.message(this.store.notice || "恢复失败，未替换设置。"); return; }
      this.host.changed("已恢复默认设置。", "settings-heading");
    });
  }

  export(kind: string): void {
    let source: string | null;
    let filename: string;
    if (kind === "export-settings") { source = exportConfiguration(this.store.data); filename = "settings"; }
    else if (kind === "export-workspace") { source = JSON.stringify({ format: "NekoPapa workspace index", exportedAt: new Date().toISOString(), state: this.workspace.state }, null, 2); filename = "workspace-index"; }
    else if (kind === "export-previous") {
      source = this.store.previousBackup;
      try { if (source) source = exportConfiguration(JSON.parse(source) as ConfigurationData); }
      catch { this.host.message("上次设置备份无法读取。请先检查本机存储。" ); return; }
      filename = "settings-previous";
    } else { source = this.store.recoveryData; filename = "settings-recovery"; }
    if (!source) { this.host.message(kind === "export-previous" ? "尚无替换前备份。首次导入或恢复默认设置时会生成。" : "没有损坏的原始设置需要导出。"); return; }
    try {
      const url = URL.createObjectURL(new Blob([source], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `nekopapa-${filename}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.host.message("已生成导出文件。");
    } catch { this.host.message("导出失败，请重试。" ); }
  }

  private confirm(title: string, description: string, apply: () => void): void {
    const dialog = this.overlays.dialog(`<h2 class="dialog-heading" id="dialog-title">${title}</h2><p class="settings-confirm-copy">${description}</p><div class="dialog-actions"><button class="text-button" type="button" data-dismiss autofocus>取消</button><button class="primary-button" type="button" data-confirm-transfer>${title}</button></div>`, "configuration-confirm-dialog");
    dialog.querySelector("[data-confirm-transfer]")!.addEventListener("click", () => { this.overlays.close(false); apply(); });
  }
}
