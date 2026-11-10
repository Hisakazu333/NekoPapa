import { useId, useRef, useState, type FormEvent } from "react";
import { CloudIcon, CodeIcon, SearchIcon } from "@/components/foundations/icons/app-icons";
import { collectionSchemas, fieldDefaults } from "@/app/configuration-contract";
import type { ConfigurationCollection, ConfigurationField, ConfigurationRecord, ConfigurationValue, ConfigurationValues } from "@/app/configuration-types";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { PillTab, PillTabList } from "@/components/base/tabs/pill-tab";
import { useConfiguration } from "@/hooks/use-configuration";
import { SettingsFields } from "./nekopapa-settings-fields";
import { presentRecord } from "./settings-record-presentation";
import { EmptyRecords, EmptyRecordsButton, NewRecordRow, RecordRow } from "./settings-record-rows";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";
import { useSettingsDraft } from "./settings-draft-context";
import { LocalModelsSection } from "./local-models-section";
import { SkillDiscoverySection } from "./skill-discovery-section";
import { CordisPatchSection } from "./cordis-patch-section";
import { useModelTests } from "./use-model-tests";
import { ModelProfileFields } from "./model-profile-fields";

type Collection = ConfigurationCollection;
/** Extensions are shown as two pages: MCP / connectors, and skills. */
export type CollectionView = "tools" | "skills";
interface Editor { id?: string; values: ConfigurationValues; base: string }
interface Removal { id: string; name: string; base: string; triggerId: string }

const searchKeys: Record<Collection, string[]> = {
  models: ["name", "provider", "model", "endpoint"], extensions: ["name", "kind", "transport", "command", "endpoint"], plugins: ["name", "module", "instanceId"],
  connections: ["name", "host", "username"], hooks: ["name", "event", "command"],
};
const toolFilters = [["all", "全部"], ["mcp", "MCP 服务"], ["connector", "连接器"]] as const;

export interface CollectionSettingsPanelProps { collection: Collection; view?: CollectionView; onClose: () => void }

export function CollectionSettingsPanel({ collection, view, onClose }: CollectionSettingsPanelProps) {
  const { store, data, storageAvailable, notice, refresh } = useConfiguration();
  const schema = collectionSchemas[collection];
  const skills = view === "skills";
  const singular = skills ? "技能" : schema.singular;
  const draftKey = skills ? "skills" : collection;
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const formId = useId();
  const modelTests = useModelTests();
  const returnFocus = useRef("");
  const inView = (record: ConfigurationRecord) => collection !== "extensions" || (skills ? record.values.kind === "skill" : record.values.kind !== "skill");
  const records = data.collections[collection].filter(inView);
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered = records.filter((record) => {
    if (view === "tools" && kind !== "all" && record.values.kind !== kind) return false;
    const text = searchKeys[collection].map((key) => String(record.values[key] ?? "")).join(" ").toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
  const removed = store.removedRecord;
  const clearDraft = useSettingsDraft(draftKey, Boolean(editor && JSON.stringify(editor.values) !== editor.base));

  const report = (message: string) => { setStatus(message); setErrors({}); };
  const backToList = () => {
    clearDraft();
    setEditor(null);
    setErrors({});
    requestAnimationFrame(() => document.getElementById(returnFocus.current)?.focus());
  };
  const open = (triggerId: string, record?: ConfigurationRecord) => {
    returnFocus.current = triggerId;
    setRemoval(null);
    setErrors({});
    setStatus("");
    const initial = fieldDefaults(schema.fields);
    if (skills) Object.assign(initial, { kind: "skill", transport: "stdio" });
    setEditor({ id: record?.id, values: record ? { ...record.values } : initial, base: JSON.stringify(record?.values) });
  };
  const prepareStorage = () => {
    if (store.storageAvailable) return true;
    const saved = store.persist();
    refresh();
    if (saved) return true;
    setErrors({ form: store.notice });
    return false;
  };
  const retryStorage = () => {
    const saved = store.persist();
    refresh();
    if (saved) report("本机配置已保存。运行服务尚未接入。");
    else setErrors({ form: store.notice });
  };
  const update = (key: string, value: ConfigurationValue) => {
    setEditor((current) => {
      if (!current) return current;
      const values = { ...current.values, [key]: value };
      if (collection === "extensions" && key === "transport") values[value === "http" ? "command" : "endpoint"] = "";
      return { ...current, values };
    });
    setErrors((current) => ({ ...current, [key]: "", form: "" }));
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || !prepareStorage()) return;
    const latest = store.data.collections[collection];
    if (editor.id && JSON.stringify(latest.find((record) => record.id === editor.id)?.values) !== editor.base) {
      setErrors({ form: "配置已被其他窗口更改或删除，请取消并重新打开。" });
      return;
    }
    const before = new Set(latest.map((record) => record.id));
    const result = store.saveRecord(collection, editor.values, editor.id);
    refresh();
    if (result) {
      setErrors(result);
      requestAnimationFrame(() => document.getElementById(`${formId}-${Object.keys(result)[0]}`)?.focus());
      return;
    }
    if (!store.storageAvailable) {
      const saved = store.data.collections[collection].find((record) => editor.id ? record.id === editor.id : !before.has(record.id));
      if (saved) setEditor({ id: saved.id, values: { ...saved.values }, base: JSON.stringify(saved.values) });
      setErrors({ form: store.notice });
      return;
    }
    backToList();
    report(collection === "models" ? "配置已保存到本机，可在“…”中测试连接，并在输入框的模型菜单中选用。" : "配置已保存到本机；执行服务尚未接入。");
  };
  const remove = () => {
    if (!removal || !prepareStorage()) return;
    const current = store.data.collections[collection].find((record) => record.id === removal.id);
    if (JSON.stringify(current?.values) !== removal.base) {
      setErrors({ form: "配置已被其他窗口更改或删除，请取消后重新选择。" });
      return;
    }
    const success = store.removeRecord(collection, removal.id);
    refresh();
    if (!success) { setErrors({ form: store.notice || "这份配置已不存在，请重新打开列表。" }); return; }
    setRemoval(null);
    requestAnimationFrame(() => document.getElementById(`${formId}-add`)?.focus());
    if (store.storageAvailable) report("已删除本机配置，可以撤销。");
    else setErrors({ form: store.notice });
  };
  const undo = () => {
    if (!prepareStorage()) return;
    const success = store.restoreRemoved();
    refresh();
    if (!success) setErrors({ form: store.notice || "这份配置已无法撤销，请检查列表。" });
    else if (!store.storageAvailable) setErrors({ form: store.notice });
    else report("已恢复原配置。");
  };
  const fields = editorFields(schema.fields, view, editor?.values);
  const add = () => open(`${formId}-add`);
  const atLimit = data.collections[collection].length >= 100;

  return (
    <>
      <ModalBody>
        <div className="flex flex-col gap-6">
          {!storageAvailable && <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-border-error-default p-3">
            <p className="text-body-regular text-text-error-primary">{notice || "本机存储暂不可用。"}</p>
            <Button variant="secondary" size="small" className="self-start" onClick={retryStorage}>重试保存</Button>
          </div>}
          {errors.form && <p role="alert" className="text-body-regular text-text-error-primary">{errors.form}</p>}
          {status && <p role="status" className="text-body-regular text-text-secondary">{status}</p>}
          {editor ? (
            <form id={formId} onSubmit={save} noValidate className="flex flex-col gap-2">
              <SettingsSectionLabel>{editor.id ? "编辑" : "新增"}{singular}</SettingsSectionLabel>
              <SettingsCard>{collection === "models"
                ? <ModelProfileFields fields={fields} values={editor.values} errors={errors} onChange={update} prefix={formId} />
                : <SettingsFields fields={fields} values={editor.values} errors={errors} onChange={update} prefix={formId} />}</SettingsCard>
            </form>
          ) : (
            <>
              {collection === "models" && <ModelDefaults records={records} />}
              {collection === "models" && <LocalModelsSection />}
              {view === "tools" && <PillTabList aria-label="按类型筛选" className="-mx-1 flex w-[calc(100%+8px)] overflow-x-auto px-1">
                {toolFilters.map(([id, label]) => <PillTab key={id} variant="gray" isSelected={kind === id} onSelect={() => setKind(id)}>{label}</PillTab>)}
              </PillTabList>}
              <section className="flex flex-col gap-2" aria-label={skills ? "技能" : schema.title}>
                <div className="flex flex-col gap-0.5">
                  <SettingsSectionLabel>{skills ? "技能目录" : schema.title}{records.length > 0 && ` · ${records.length}`}</SettingsSectionLabel>
                  <p className="px-3 text-body-2-regular text-text-tertiary">{skills ? "保存包含 SKILL.md 的本地目录。保存不会读取、安装或执行目录中的内容。" : schema.description}</p>
                </div>
                {records.length > 0 && <Input aria-label={`搜索${skills ? "技能" : schema.title}`} placeholder="搜索名称、地址或命令" size="small" value={query} onChange={setQuery} leadingIcon={SearchIcon} type="search" />}
                {removed?.collection === collection && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-background-secondary-default py-2 ps-3 pe-2.5">
                  <p className="min-w-0 text-body-2-regular text-text-secondary">已删除「{removed.name}」</p>
                  <Button variant="secondary" size="small" onClick={undo}>撤销删除</Button>
                </div>}
                {removal && <div role="group" aria-label="确认删除配置" className="flex flex-col gap-3 rounded-2xl border border-border-error-default p-3">
                  <p className="break-words text-body-regular text-text-primary">删除「{removal.name}」？{collection === "models" && "引用它的 Agent 和 Coding 默认模型会一并取消指定。"}</p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" size="small" onClick={() => { const id = removal.triggerId; setRemoval(null); setErrors({}); requestAnimationFrame(() => document.getElementById(id)?.focus()); }}>取消</Button>
                    <Button variant="danger" size="small" onClick={remove}>确认删除</Button>
                  </div>
                </div>}
                {records.length === 0 ? (
                  <EmptyRecords title={`还没有${singular}`} description={skills ? "添加技能目录后，未来的 Agent 可以按需读取其中的说明。" : collection === "models" ? "选择服务商并填写模型后保存，即可在输入框的模型菜单中选用。" : "新增后保存在本机；执行服务尚未接入。"}
                    action={<EmptyRecordsButton id={`${formId}-add`} onPress={add}>新增{singular}</EmptyRecordsButton>} />
                ) : (
                  <SettingsCard>
                    {filtered.length === 0 && <p className="border-b border-separator-border py-3 pe-2.5 text-body-2-regular text-text-tertiary">没有匹配的配置，请修改搜索内容或筛选条件。</p>}
                    {filtered.length > 0 && <ul aria-label={`已保存的${singular}`}>
                      {filtered.map((record) => {
                        const menuId = `${formId}-menu-${record.id}`;
                        const name = String(record.values.name);
                        return <RecordRow key={record.id} menuId={menuId} name={name} {...presentRecord(collection, record, data.groups)}
                          onEdit={() => open(menuId, record)}
                          {...(collection === "models" ? { onTest: () => void modelTests.test(record), test: modelTests.results[record.id] } : {})}
                          onRemove={() => { setRemoval({ id: record.id, name, base: JSON.stringify(record.values), triggerId: menuId }); setErrors({}); setStatus(""); }} />;
                      })}
                    </ul>}
                    <NewRecordRow id={`${formId}-add`} label={`新增${singular}`} isDisabled={atLimit} onPress={add}
                      description={atLimit ? "已达到 100 份配置上限。" : skills ? "选择一个本地技能目录。" : collection === "models" ? "保存后可在“…”中测试连接，并在输入框的模型菜单中选用。" : "仅保存配置，不会连接或执行。"} />
                  </SettingsCard>
                )}
              </section>
              {skills && <SkillDiscoverySection onStatus={(message, error) => error ? setErrors({ form: message }) : report(message)} />}
              {collection === "plugins" && <CordisPatchSection records={records} onStatus={(message, error) => error ? setErrors({ form: message }) : report(message)} />}
            </>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        {editor ? <>
          <Button variant="secondary" onClick={backToList}>取消</Button>
          <Button type="submit" form={formId}>{storageAvailable ? "保存配置" : "重试保存配置"}</Button>
        </> : <Button variant="secondary" onClick={() => { clearDraft(); onClose(); }}>关闭</Button>}
      </ModalFooter>
    </>
  );
}

/** Skills keep a local directory only; tools choose MCP / connector and a transport. */
function editorFields(fields: readonly ConfigurationField[], view: CollectionView | undefined, values?: ConfigurationValues): ConfigurationField[] {
  if (view === "skills") {
    return fields.filter((field) => ["name", "command"].includes(field.key))
      .map((field) => field.key === "command" ? { ...field, label: "技能目录", hint: "包含 SKILL.md 的目录路径。保存时不会读取或执行。", control: "directory" as const, required: true, placeholder: "~/.claude/skills/名称" } : field);
  }
  // Only tools switch between a local command and an HTTP endpoint; models always need their endpoint.
  if (view !== "tools") return [...fields];
  return fields.filter((field) => values?.transport === "http" ? field.key !== "command" : field.key !== "endpoint")
    .map((field) => view === "tools" && field.key === "kind" ? { ...field, options: field.options?.filter(([id]) => id !== "skill") } : field);
}

function ModelDefaults({ records }: { records: ConfigurationRecord[] }) {
  const { data } = useConfiguration();
  const modelName = (id: unknown) => String(records.find((record) => record.id === id)?.values.name ?? "未指定");
  return <section className="flex flex-col gap-2" aria-label="默认模型">
    <SettingsSectionLabel>默认模型</SettingsSectionLabel>
    <SettingsCard>
      <SettingsRow label="通用 Agent" description="在 Agent 设置中选择；聊天服务尚未读取这些配置。">
        <span className="flex min-w-0 items-center gap-2 text-body-2-regular text-text-primary"><CloudIcon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden /><span className="max-w-40 truncate">{modelName(data.groups.agent?.modelId)}</span></span>
      </SettingsRow>
      <SettingsRow label="Coding Agent" description="在 Coding 设置中选择；Coding 执行层接入后使用。">
        <span className="flex min-w-0 items-center gap-2 text-body-2-regular text-text-primary"><CodeIcon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden /><span className="max-w-40 truncate">{modelName(data.groups.coding?.modelId)}</span></span>
      </SettingsRow>
    </SettingsCard>
  </section>;
}
