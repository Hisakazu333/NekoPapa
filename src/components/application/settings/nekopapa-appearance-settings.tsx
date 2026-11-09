import { useEffect, useRef, useState } from "react";
import type { FocusEvent as ReactFocusEvent, PointerEvent as ReactPointerEvent } from "react";
import { parseColor } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { ColorPicker } from "@/components/base/color-picker/color-picker";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { Select, SelectItem } from "@/components/base/select/select";
import { RadioCard } from "@/components/base/radio/radio-card";
import { RadioGroup } from "@/components/base/radio/radio";
import { Switch } from "@/components/base/switch/switch";
import { toast } from "@/components/base/toast/toast";
import { APPEARANCE_ACCENTS, normalizeAppearanceAccent, normalizeAppearanceMode, type AppearanceAccent, type AppearanceMode } from "@/app/appearance-preferences";
import { saveConfigurationDraft } from "@/app/configuration-draft";
import type { ConfigurationValues } from "@/app/configuration-types";
import { applyThemeWithTransition, useThemeMode } from "@/components/application/theme/theme-toggle";
import { applyAppearance } from "@/app/appearance";
import { useConfiguration } from "@/hooks/use-configuration";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";
import { useSettingsDraft } from "./settings-draft-context";

const modeOptions = [
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
  { id: "system", label: "自动" },
] as const satisfies readonly { id: AppearanceMode; label: string }[];
const fontOptions = [
  ["system", "系统字体"], ["serif", "衬线字体"], ["mono", "等宽字体"],
] as const;
const densityOptions = [
  ["comfortable", "舒适"], ["compact", "紧凑"],
] as const;

const accentColors: Record<Exclude<AppearanceAccent, `#${string}`>, string> = {
  green: "#6f7b63",
  blue: "#597fa7",
  purple: "#8771a3",
  orange: "#a8754f",
};
const accentByColor = new Map(Object.entries(accentColors).map(([id, color]) => [color, id as AppearanceAccent]));
const accentHex = (value: AppearanceAccent) => value.startsWith("#") ? value : accentColors[value as keyof typeof accentColors];

const themePreview = {
  light: { label: "浅色", description: "明亮的工作区背景" },
  dark: { label: "深色", description: "低亮度的工作区背景" },
  system: { label: "自动", description: "跟随设备当前外观" },
} as const;

function ThemePreviewCard({ id, actualTheme, onPointerDown, onFocus }: {
  id: AppearanceMode;
  actualTheme: "light" | "dark";
  onPointerDown: (event: ReactPointerEvent<HTMLLabelElement>) => void;
  onFocus: (event: ReactFocusEvent<Element>) => void;
}) {
  const preview = themePreview[id];
  return <RadioCard value={id} aria-label={preview.label} showRadio={false}
    onPointerDown={onPointerDown} onFocus={onFocus}
    className={(state) => `min-w-0 flex-1 flex-col items-stretch gap-2 p-2 ${state.isSelected ? "border-border-focus-ring ring-2 ring-border-focus-ring" : ""}`}>
    <ThemeThumbnail mode={id} actualTheme={actualTheme} />
    <span className="flex flex-col gap-1 px-1">
      <span className="text-body-medium text-text-primary">{preview.label}</span>
      <span className="text-body-2-regular text-text-tertiary">{preview.description}</span>
    </span>
  </RadioCard>;
}

function ThemeThumbnail({ mode, actualTheme }: { mode: AppearanceMode; actualTheme: "light" | "dark" }) {
  const light = actualTheme === "dark"
    ? { canvas: "bg-text-primary", rail: "bg-text-primary", panel: "bg-text-primary", line: "bg-background-full" }
    : { canvas: "bg-background-full", rail: "bg-background-secondary-default", panel: "bg-background-primary-default", line: "bg-background-secondary-hover" };
  const dark = actualTheme === "dark"
    ? { canvas: "bg-background-full", rail: "bg-background-secondary-default", panel: "bg-background-primary-default", line: "bg-background-secondary-hover" }
    : { canvas: "bg-text-primary", rail: "bg-text-primary", panel: "bg-background-secondary-default", line: "bg-background-secondary-hover" };
  const modes = mode === "system" ? ["light", "dark"] as const : [mode] as const;
  return <span aria-hidden className="grid aspect-[1.6] w-full overflow-hidden rounded-xl border border-separator-border" style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}>
    {modes.map((target) => {
      const palette = target === "light" ? light : dark;
      return <span key={target} className={`relative flex min-w-0 overflow-hidden ${palette.canvas}`}>
        <span className={`flex w-[23%] shrink-0 flex-col gap-1 p-1 ${palette.rail}`}>
          <span className="size-2 rounded-sm bg-accent-500" />
          <span className={`mt-1 h-1 rounded ${palette.line}`} />
          <span className={`h-1 rounded ${palette.line} opacity-70`} />
          <span className={`h-1 rounded ${palette.line} opacity-50`} />
        </span>
          <span className={`relative m-1 flex min-w-0 flex-1 flex-col gap-1 rounded-md p-1.5 ${palette.panel}`}>
          <span className={`h-1 w-2/5 rounded ${palette.line}`} />
          <span className="mt-auto ms-auto h-2 w-2/3 rounded-md bg-accent-500" />
          <span className={`h-1 w-full rounded ${palette.line}`} />
          <span className={`absolute bottom-1 end-1 size-1.5 rounded-full bg-accent-600`} />
        </span>
      </span>;
    })}
  </span>;
}

const fieldLabels: Record<string, string> = { mode: "主题模式", font: "字体", density: "界面密度", reducedMotion: "减少动态效果" };

const equal = (left: ConfigurationValues, right: ConfigurationValues) => JSON.stringify(left) === JSON.stringify(right);

export function AppearanceSettingsPanel({ onClose }: { onClose: () => void }) {
  const { store, data, storageAvailable, notice, refresh } = useConfiguration();
  const currentTheme = useThemeMode();
  const themeInteraction = useRef<{ origin: { x: number; y: number } | null; element: HTMLElement | null }>({ origin: null, element: null });
  const [base, setBase] = useState<ConfigurationValues>(() => ({ ...data.groups.appearance }));
  const [mode, setMode] = useState<AppearanceMode>(() => normalizeAppearanceMode(data.groups.appearance.mode));
  const [accent, setAccent] = useState<AppearanceAccent>(() => normalizeAppearanceAccent(data.groups.appearance.accent));
  const [font, setFont] = useState(String(data.groups.appearance.font ?? "system"));
  const [density, setDensity] = useState(String(data.groups.appearance.density ?? "comfortable"));
  const [reducedMotion, setReducedMotion] = useState(data.groups.appearance.reducedMotion === true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const savedAppearance = useRef(base);
  const dirty = mode !== normalizeAppearanceMode(base.mode)
    || accent !== normalizeAppearanceAccent(base.accent)
    || font !== String(base.font ?? "system")
    || density !== String(base.density ?? "comfortable")
    || reducedMotion !== (base.reducedMotion === true);
  const clearDraft = useSettingsDraft("appearance", dirty);
  const updated = !equal(data.groups.appearance, base);

  useEffect(() => {
    if (!dirty && updated) {
      const current = { ...data.groups.appearance };
      setBase(current);
      setMode(normalizeAppearanceMode(current.mode));
      setAccent(normalizeAppearanceAccent(current.accent));
      setFont(String(current.font ?? "system"));
      setDensity(String(current.density ?? "comfortable"));
      setReducedMotion(current.reducedMotion === true);
      savedAppearance.current = current;
    }
  }, [data, dirty, updated]);

  useEffect(() => () => applyAppearance(savedAppearance.current), []);

  const loadCurrent = () => {
    const current = { ...store.data.groups.appearance };
    setBase(current);
    setMode(normalizeAppearanceMode(current.mode));
    setAccent(normalizeAppearanceAccent(current.accent));
    setFont(String(current.font ?? "system"));
    setDensity(String(current.density ?? "comfortable"));
    setReducedMotion(current.reducedMotion === true);
    setErrors({});
    setConflicts([]);
    setStatus("已载入当前保存的外观。");
    savedAppearance.current = current;
  };

  const save = (overwrite = false) => {
    const draft = { ...base, mode, accent, font, density, reducedMotion };
    const result = saveConfigurationDraft(store, "appearance", draft, base, overwrite);
    refresh();
    setErrors(result.errors);
    setConflicts(result.conflicts);
    if (!result.saved) {
      setStatus("");
      return;
    }
    setBase(result.values);
    setMode(normalizeAppearanceMode(result.values.mode));
    setAccent(normalizeAppearanceAccent(result.values.accent));
    setFont(String(result.values.font ?? "system"));
    setDensity(String(result.values.density ?? "comfortable"));
    setReducedMotion(result.values.reducedMotion === true);
    savedAppearance.current = result.values;
    clearDraft();
    setStatus("");
    toast.success("外观已保存", { description: "已立即应用到整个客户端。" });
  };

  const retry = () => {
    const saved = store.persist();
    refresh();
    setErrors(saved ? {} : { form: store.notice });
    if (!saved) return;
    setStatus(dirty ? "本机保存已恢复，当前草稿仍保留。保存外观后应用你的选择。" : "当前窗口中的外观已保存。");
  };

  return (
    <>
      <ModalBody>
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2" aria-label="视觉风格">
            <SettingsSectionLabel>视觉风格</SettingsSectionLabel>
            <SettingsCard>
              <div className="flex flex-col gap-3 p-3">
                <div><p className="text-body-regular text-text-primary">主题模式</p><p className="mt-1 text-body-2-regular text-text-secondary">选择后先更新预览；保存后应用到整个客户端。</p></div>
                <RadioGroup aria-label="主题模式" value={mode} onChange={(next) => {
                  if (next !== "system" && next !== "light" && next !== "dark") return;
                  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  const resolved = next === "system" ? systemDark ? "dark" : "light" : next;
                  applyAppearance({ ...base, mode: next, accent: accentHex(accent), font, density, reducedMotion });
                  const interaction = themeInteraction.current;
                  themeInteraction.current = { origin: null, element: null };
                  void applyThemeWithTransition(resolved, { persist: false, animate: !reducedMotion, ...interaction, duration: 820 });
                  setMode(next); setErrors({}); setConflicts([]); setStatus("");
                }} className="grid grid-cols-3 gap-2">
                  {modeOptions.map((option) => <ThemePreviewCard key={option.id} id={option.id} actualTheme={currentTheme}
                    onPointerDown={(event) => { themeInteraction.current = { origin: { x: event.clientX, y: event.clientY }, element: event.currentTarget }; }}
                    onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) themeInteraction.current = { origin: null, element: event.currentTarget as HTMLElement }; }} />)}
                </RadioGroup>
              </div>
              <SettingsRow label="当前显示" description="跟随系统时显示当前实际应用的主题。">
                <span className="shrink-0 text-body-regular text-text-primary">{currentTheme === "dark" ? "深色" : "浅色"}</span>
              </SettingsRow>
              <SettingsRow label="界面密度" description="调整设置列表、输入区和工具栏的间距。">
                <Select aria-label="界面密度" selectedKey={density} size="sm" className="w-28 shrink-0" onSelectionChange={(key) => {
                  if (key === "comfortable" || key === "compact") { setDensity(key); setErrors({}); setConflicts([]); setStatus(""); }
                }}>
                  {densityOptions.map(([id, label]) => <SelectItem key={id} id={id} textValue={label}>{label}</SelectItem>)}
                </Select>
              </SettingsRow>
              <SettingsRow label="字体" description="只影响 NekoPapa 界面，不修改聊天正文内容。">
                <Select aria-label="字体" selectedKey={font} size="sm" className="w-32 shrink-0" onSelectionChange={(key) => {
                  if (key === "system" || key === "serif" || key === "mono") { setFont(key); setErrors({}); setConflicts([]); setStatus(""); }
                }}>
                  {fontOptions.map(([id, label]) => <SelectItem key={id} id={id} textValue={label}>{label}</SelectItem>)}
                </Select>
              </SettingsRow>
              <SettingsRow label="减少动态效果" description="关闭设置弹窗、主题切换和控件的过渡动画。">
                <Switch aria-label="减少动态效果" isSelected={reducedMotion} onChange={(next) => { setReducedMotion(next); setErrors({}); setConflicts([]); setStatus(""); }} />
              </SettingsRow>
            </SettingsCard>
          </section>

          <section className="flex flex-col gap-2" aria-label="强调色">
            <SettingsSectionLabel>强调色</SettingsSectionLabel>
            <SettingsCard>
              <div className="grid min-w-0 gap-5 p-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
                <div className="flex flex-col gap-1">
                  <p className="text-body-regular text-text-primary">强调色</p>
                  <p className="text-body-2-regular text-text-secondary">用于选中状态、焦点和强调控件。</p>
                  <ColorPicker
                    aria-label="强调色"
                    value={parseColor(accentHex(accent))}
                    onChange={(color) => {
                      const next = color.toString("hex").toLowerCase();
                      setAccent(accentByColor.get(next) ?? next as AppearanceAccent);
                      applyAppearance({ ...base, mode, accent: next, font, density, reducedMotion });
                      setErrors({}); setConflicts([]); setStatus("");
                    }}
                    swatches={APPEARANCE_ACCENTS.map(({ id }) => accentColors[id])}
                    className="mt-2 w-full"
                  />
                  {errors.accent && <p role="alert" className="mt-1 text-body-2-regular text-text-error-primary">{errors.accent}</p>}
                </div>
                <AccentEffectPreview />
              </div>
            </SettingsCard>
            <p className="px-3 text-body-2-regular text-text-tertiary">使用 BoardUI Color Picker 选择预设或自定义 HEX 颜色；保存后会生成整套 accent 语义色阶。</p>
          </section>

          <p className="text-body-2-regular text-text-secondary">选择会先保留为草稿；保存后立即应用，取消会丢弃草稿并保留已保存外观。</p>
          {updated && dirty && <div role="status" className="flex flex-col gap-2 rounded-xl border border-border-button-default p-3">
            <p className="text-body-2-regular text-text-secondary">已保存的外观在其他位置更新。当前草稿仍保留；保存时会检查冲突。</p>
            <Button variant="secondary" size="small" className="self-start" onClick={loadCurrent}>放弃草稿并载入最新值</Button>
          </div>}
          {!storageAvailable && <div className="flex flex-col gap-2 rounded-xl border border-border-error-default p-3">
            <p className="text-body-2-regular text-text-error-primary" role="alert">{notice || "当前外观尚未保存到本机。"}</p>
            <Button variant="secondary" size="small" className="self-start" onClick={retry}>重试保存当前外观</Button>
          </div>}
          {errors.form && <p role="alert" className="text-body-regular text-text-error-primary">{errors.form}</p>}
          {Object.entries(errors).filter(([field]) => field !== "form" && field !== "accent").map(([field, message]) => (
            <p key={field} role="alert" className="text-body-regular text-text-error-primary">{fieldLabels[field] ?? field}：{message}</p>
          ))}
          {conflicts.length > 0 && <div className="flex flex-col gap-3 rounded-xl border border-border-error-default p-3" aria-label="解决外观冲突">
            <p className="text-body-2-regular text-text-secondary">主题模式或强调色已在其他位置更改。</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="small" onClick={loadCurrent}>载入最新值</Button>
              <Button size="small" onClick={() => save(true)}>使用我的更改保存</Button>
            </div>
          </div>}
          {status && <p role="status" className="text-body-regular text-text-secondary">{status}</p>}
          {dirty && <p className="text-body-2-regular text-text-tertiary">有未保存的更改。取消不会更改已保存外观。</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={() => { const current = { ...store.data.groups.appearance }; applyAppearance(current); loadCurrent(); clearDraft(); onClose(); }}>取消</Button>
        <Button onClick={() => save()}>{storageAvailable ? "保存外观" : "重试并保存外观"}</Button>
      </ModalFooter>
    </>
  );
}

function AccentEffectPreview() {
  return <div className="flex min-w-0 flex-col gap-3 rounded-2xl bg-background-secondary-default p-3">
    <p className="text-body-medium text-text-primary">控件效果</p>
    <div aria-hidden="true" className="pointer-events-none flex flex-wrap items-center gap-3">
      <Button tabIndex={-1}>主要操作</Button>
      <span className="rounded-lg bg-accent-50 px-2.5 py-1.5 text-body-2-medium text-accent-700">选中项目</span>
      <span className="grid size-8 place-items-center rounded-lg border border-border-button-default bg-background-primary-default ring-2 ring-border-focus-ring">
        <span className="size-2.5 rounded-full bg-accent-600" />
      </span>
    </div>
    <p className="text-body-2-regular text-text-tertiary">更改颜色后，选中状态、主要按钮和焦点样式会同步预览。</p>
  </div>;
}
