import { useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Select, SelectItem } from "@/components/base/select/select";
import { desktopToolError, desktopTools, desktopToolsAvailable, PET_WINDOW, type AccountPetChoice, type PetStatus } from "@/app/desktop/desktop-tools";
import { useAccountSession } from "../account/account-session";
import { DesktopToolPanel, useDesktopAction } from "./desktop-tool-settings";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";

async function pickModel(format: "zip" | "json") {
  const { open } = await import("@tauri-apps/plugin-dialog");
  return open({
    title: format === "zip" ? "选择 Live2D 模型包" : "选择 Live2D 模型入口",
    filters: [{ name: format === "zip" ? "Live2D ZIP" : "Live2D 模型入口", extensions: [format] }],
  });
}

export function DesktopPetSettings({ onClose }: { onClose: () => void }) {
  const { profile } = useAccountSession();
  const available = desktopToolsAvailable();
  const [selected, setSelected] = useState<"account" | "local">();
  const source = selected ?? (profile ? "account" : "local");
  const { pending, error, run, setError } = useDesktopAction();
  const [pet, setPet] = useState<PetStatus>();
  const refresh = async () => setPet(await desktopTools.petStatus());

  useEffect(() => {
    if (!available) return;
    let active = true;
    const load = () => void desktopTools.petStatus().then((next) => {
      if (active) setPet(next);
    }).catch((failure) => { if (active) setError(desktopToolError(failure)); });
    load();
    window.addEventListener("focus", load);
    return () => { active = false; window.removeEventListener("focus", load); };
  }, [available, setError]);

  return <DesktopToolPanel onClose={onClose}>
    <SegmentedControl aria-label="模型来源" selectedKeys={[source]} onSelectionChange={(keys) => {
      const next = [...keys][0];
      if (next === "account" || next === "local") { setSelected(next); setError(""); }
    }}>
      <SegmentedControlItem id="account" isDisabled={pending}>账号模型</SegmentedControlItem>
      <SegmentedControlItem id="local" isDisabled={pending}>本机模型</SegmentedControlItem>
    </SegmentedControl>
    {source === "account"
      ? available && profile
        ? <AccountModelSettings key={profile.userId} pet={pet} onChange={refresh} />
        : <p role="status" className="text-body-2-regular text-text-secondary">在桌面应用登录 NekoPapa 后，可以使用账号同伴或上传私人模型包。</p>
      : <SettingsCard>
        <SettingsRow label="本机 Live2D 模型" description="选择已解压的 .model3.json；贴图和动作文件留在原目录，仅在这台设备上使用。">
          <Button size="small" variant="secondary" disabled={!available || pending} onClick={() => void run(async () => {
            const path = await pickModel("json");
            if (!path) return;
            await desktopTools.importPet(path);
            if (pet?.source === "local") await desktopTools.close(PET_WINDOW);
            await refresh();
          })}>{pet?.modelPath ? "更换模型" : "选择模型"}</Button>
        </SettingsRow>
        <SettingsRow label="桌面陪伴" description="在可拖动的透明窗口中显示。">
          <Button size="small" disabled={!available || pending || !pet?.modelPath || pet.source === "account"}
            onClick={() => void run(async () => {
              if (pet?.visible) await desktopTools.close(PET_WINDOW);
              else await desktopTools.showPet();
              await refresh();
            })}>{pet?.source === "local" ? "关闭桌宠" : "显示桌宠"}</Button>
        </SettingsRow>
      </SettingsCard>}
    {source === "local" && pet?.modelPath && <p translate="no" className="break-all text-caption-1-regular text-text-secondary">{pet.modelPath}</p>}
    {pet?.visible && pet.source !== source && <SettingsCard>
      <SettingsRow label="另一个模型正在显示" description="关闭后，可以打开当前来源的模型。">
        <Button size="small" variant="secondary" disabled={pending} onClick={() => void run(async () => {
          await desktopTools.close(PET_WINDOW); await refresh();
        })}>关闭当前桌宠</Button>
      </SettingsRow>
    </SettingsCard>}
    {error && <p role="alert" className="text-body-2-regular text-text-error-primary">{error}</p>}
  </DesktopToolPanel>;
}

function AccountModelSettings({ pet, onChange }: { pet?: PetStatus; onChange: () => Promise<void> }) {
  const [models, setModels] = useState<AccountPetChoice[]>();
  const [choice, setChoice] = useState<string>();
  const [file, setFile] = useState<string>();
  const [resource, setResource] = useState<string>();
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const { pending, error, run, setError } = useDesktopAction();
  const [loading, setLoading] = useState(true);
  const refresh = async () => setModels(await desktopTools.accountPets());

  useEffect(() => {
    let active = true;
    void desktopTools.accountPets().then((next) => { if (active) setModels(next); })
      .catch((failure) => { if (active) setError(desktopToolError(failure)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setError]);

  const current = models?.find((model) => model.current);
  const selection = choice && models?.some(({ id }) => id === choice) ? choice : "current";
  const filename = file?.split(/[\\/]/).pop();
  return <>
    <SettingsSectionLabel>我的账号同伴</SettingsSectionLabel>
    <SettingsCard>
      <SettingsRow label="桌宠模型" description="默认跟随账号当前同伴，也可以单独选一个模型显示。">
        <Select size="sm" aria-label="选择账号同伴" selectedKey={selection} isDisabled={!models?.length || pending}
          onSelectionChange={(key) => setChoice(key && key !== "current" ? String(key) : undefined)}>
          <SelectItem id="current">{current ? `跟随当前 · ${current.name}` : "跟随账号当前同伴"}</SelectItem>
          {models?.map((model) => <SelectItem key={model.id} id={model.id}>{model.name}</SelectItem>)}
        </Select>
      </SettingsRow>
      <SettingsRow label="桌面陪伴" description={loading ? "正在读取账号同伴…" : models && !models.length ? "账号暂时没有可用的 Live2D 模型。" : "模型会在打开时从账号服务获取。"}>
        <div className="flex shrink-0 gap-2">
          <Button size="small" variant="secondary" disabled={pending || loading} onClick={() => void run(refresh)}>刷新</Button>
          <Button size="small" disabled={pending || (pet?.source !== "account" && (pet?.visible || loading || (!current && selection === "current")))}
            onClick={() => void run(async () => {
              if (pet?.source === "account") await desktopTools.close(PET_WINDOW);
              else await desktopTools.showAccountPet(selection === "current" ? undefined : selection);
              await onChange();
            })}>{pet?.source === "account" ? "关闭桌宠" : "显示桌宠"}</Button>
        </div>
      </SettingsRow>
    </SettingsCard>
    <SettingsSectionLabel>上传私人模型</SettingsSectionLabel>
    <SettingsCard>
      <SettingsRow label="Live2D ZIP" description="选择 80 MB 以内的模型包，需包含一个 .model3.json 及其资源。确认上传后会在当前账号创建私人同伴。" stacked>
        <div className="flex min-w-0 items-center gap-2">
          <Button size="small" variant="secondary" disabled={pending || Boolean(resource)} onClick={() => void run(async () => {
            const path = await pickModel("zip");
            if (path) { setFile(path); setNotice(""); }
          })}>选择 ZIP</Button>
          {filename && <span translate="no" title={filename} className="min-w-0 truncate text-body-2-regular text-text-secondary">{filename}</span>}
        </div>
        {file && <div className="flex items-end gap-2">
          <Input label="私人同伴名称" value={name} onChange={setName} maxLength={80} isDisabled={pending} size="small" className="min-w-0 flex-1" />
          <Button size="small" disabled={pending || !name.trim()} onClick={() => void run(async () => {
            setNotice("");
            const uploaded = resource ?? await desktopTools.uploadPet(file);
            setResource(uploaded);
            await desktopTools.bindPet(uploaded, name);
            setResource(undefined); setFile(undefined); setName("");
            setNotice("私人同伴已保存到当前账号。");
            await refresh();
          })}>{pending ? "处理中…" : resource ? "重试创建同伴" : "上传并创建"}</Button>
        </div>}
        {resource && <p className="text-caption-1-regular text-text-secondary">模型包已上传，可以直接重试创建同伴。</p>}
      </SettingsRow>
    </SettingsCard>
    {notice && <p role="status" className="text-body-2-regular text-text-secondary">{notice}</p>}
    {error && <p role="alert" className="text-body-2-regular text-text-error-primary">{error}</p>}
  </>;
}
