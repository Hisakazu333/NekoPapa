import { useId, useRef, useState, type FormEvent } from "react";
import { RiAddLine, RiSearchLine } from "@remixicon/react";
import { collectionSchemas, fieldDefaults } from "@/app/configuration-contract";
import type { ConfigurationCollection, ConfigurationRecord, ConfigurationValue, ConfigurationValues } from "@/app/configuration-types";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { useConfiguration } from "@/hooks/use-configuration";
import { SettingsFields } from "./nekopapa-settings-fields";

type Collection = ConfigurationCollection;
interface Editor { id?: string; values: ConfigurationValues; base: string }
interface Removal { id: string; name: string; base: string; triggerId: string }

export interface CollectionSettingsPanelProps { collection: Collection; onClose: () => void }

export function CollectionSettingsPanel({ collection, onClose }: CollectionSettingsPanelProps) {
  const { store, data, storageAvailable, notice, refresh } = useConfiguration();
  const schema = collectionSchemas[collection];
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const formId = useId();
  const returnFocus = useRef("");
  const records = data.collections[collection];
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered = records.filter((record) => {
    const keys = { models: ["name", "provider", "model", "endpoint"], extensions: ["name", "kind", "transport"], connections: ["name", "host", "username"], hooks: ["name", "event", "command"] }[collection];
    const text = keys.map((key) => String(record.values[key] ?? "")).join(" ").toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
  const removed = store.removedRecord;

  const report = (message: string) => { setStatus(message); setErrors({}); };
  const backToList = () => {
    setEditor(null);
    setErrors({});
    requestAnimationFrame(() => document.getElementById(returnFocus.current)?.focus());
  };
  const open = (trigger: HTMLButtonElement, record?: ConfigurationRecord) => {
    returnFocus.current = trigger.id;
    setRemoval(null);
    setErrors({});
    setStatus("");
    setEditor({ id: record?.id, values: record ? { ...record.values } : fieldDefaults(schema.fields), base: JSON.stringify(record?.values) });
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
      if (collection === "extensions") {
        if (key === "kind" && value === "skill") { values.transport = "stdio"; values.endpoint = ""; }
        if (key === "transport") values[value === "http" ? "command" : "endpoint"] = "";
      }
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
    report("配置已保存到本机；执行与连接测试尚未接入。");
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
  const fields = schema.fields.filter((field) => collection !== "extensions"
    || (editor?.values.transport === "http" ? field.key !== "command" : field.key !== "endpoint"))
    .map((field) => field.key === "transport" && editor?.values.kind === "skill"
      ? { ...field, options: [["stdio", "本地技能目录"]] as const } : field);

  return (
    <>
      <ModalBody>
        <div className="flex flex-col gap-5">
          <p className="text-body-regular text-text-secondary">{schema.description}</p>
          {collection === "models" && <p className="text-body-2-regular text-text-tertiary">当前聊天服务尚未读取这些本机配置；聊天运行环境由服务端配置。</p>}
          {!storageAvailable && <div role="alert" className="flex flex-col gap-2 rounded-2lg border border-border-error-default p-3">
            <p className="text-body-regular text-text-error-primary">{notice || "本机存储暂不可用。"}</p>
            <Button variant="secondary" onClick={retryStorage}>重试保存</Button>
          </div>}
          {errors.form && <p role="alert" className="text-body-regular text-text-error-primary">{errors.form}</p>}
          {status && <p role="status" className="text-body-regular text-text-secondary">{status}</p>}
          {editor ? (
            <form id={formId} onSubmit={save} noValidate className="flex flex-col gap-4">
              <h3 className="text-body-medium text-text-primary">{editor.id ? "编辑" : "新增"}{schema.singular}</h3>
              <SettingsFields fields={fields} values={editor.values} errors={errors} onChange={update} prefix={formId} />
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-body-medium text-text-primary">已保存 {records.length} 份配置</h3>
                <Button id={`${formId}-add`} leadingIcon={RiAddLine} onClick={(event) => open(event.currentTarget)} disabled={records.length >= 100}>新增{schema.singular}</Button>
              </div>
              <Input label={`搜索${schema.title}`} value={query} onChange={setQuery} leadingIcon={RiSearchLine} type="search" />
              {removed?.collection === collection && <div className="flex flex-wrap items-center justify-between gap-2 rounded-2lg bg-background-secondary-default p-3">
                <p className="min-w-0 text-body-regular text-text-secondary">已删除「{removed.name}」</p>
                <Button variant="secondary" onClick={undo}>撤销删除</Button>
              </div>}
              {removal && <div role="group" aria-label="确认删除配置" className="flex flex-col gap-3 rounded-2lg border border-border-error-default p-3">
                <p className="break-words text-body-regular text-text-primary">删除「{removal.name}」？{collection === "models" && "引用它的 Agent 和 Coding 默认模型会一并取消指定。"}</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="secondary" onClick={() => { const id = removal.triggerId; setRemoval(null); setErrors({}); requestAnimationFrame(() => document.getElementById(id)?.focus()); }}>取消</Button>
                  <Button variant="danger" onClick={remove}>确认删除</Button>
                </div>
              </div>}
              {filtered.length === 0 ? <p className="rounded-2lg bg-background-secondary-default p-4 text-body-regular text-text-tertiary">{records.length === 0 ? `还没有${schema.singular}，新增后保存在本机。` : "没有匹配的配置，请修改搜索内容。"}</p> : (
                <ul className="flex flex-col divide-y divide-separator-border">
                  {filtered.map((record) => <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1 basis-44">
                      <p className="truncate text-body-medium text-text-primary">{String(record.values.name)}</p>
                      <p className="mt-1 break-all text-body-2-regular text-text-tertiary">{recordSummary(collection, record)}</p>
                      <p className="mt-1 text-body-2-regular text-text-tertiary">执行服务待接入</p>
                    </div>
                    <div className="flex gap-2">
                      <Button id={`${formId}-edit-${record.id}`} variant="secondary" aria-label={`编辑${record.values.name}`} onClick={(event) => open(event.currentTarget, record)}>编辑</Button>
                      <Button id={`${formId}-remove-${record.id}`} variant="ghost" aria-label={`删除${record.values.name}`} onClick={(event) => { setRemoval({ id: record.id, name: String(record.values.name), base: JSON.stringify(record.values), triggerId: event.currentTarget.id }); setErrors({}); setStatus(""); }}>删除</Button>
                    </div>
                  </li>)}
                </ul>
              )}
            </>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        {editor ? <>
          <Button variant="secondary" onClick={backToList}>取消</Button>
          <Button type="submit" form={formId}>{storageAvailable ? "保存配置" : "重试保存配置"}</Button>
        </> : <Button variant="secondary" onClick={onClose}>关闭</Button>}
      </ModalFooter>
    </>
  );
}

function recordSummary(collection: Collection, record: ConfigurationRecord) {
  const fields = collectionSchemas[collection].fields;
  const option = (key: string) => fields.find((field) => field.key === key)?.options?.find(([id]) => id === record.values[key])?.[1];
  if (collection === "models") return `${option("provider")} · ${record.values.model}`;
  if (collection === "connections") return `${record.values.host}:${record.values.port} · ${record.values.username}`;
  if (collection === "hooks") return `${option("event")} · ${record.values.timeout} 秒`;
  return `${option("kind")} · ${option("transport")}`;
}
