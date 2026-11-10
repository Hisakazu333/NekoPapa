import { useState, type ClipboardEvent } from "react";
import { ListIcon, PlusIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { MODELS_PER_CONNECTION, validModelId } from "@/app/models/model-connection-models";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { cx } from "@/utils/cx";
import { SettingsRow } from "./settings-rows";
import type { ModelListState } from "./use-model-tests";

export function ModelSelectionFields({ prefix, selected, error, list, onFetch, onChange }: {
  prefix: string;
  selected: string[];
  error?: string;
  list: ModelListState | null;
  onFetch: () => void;
  onChange: (models: string[]) => void;
}) {
  const [entry, setEntry] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const id = `${prefix}-model`;
  const add = (ids: string[]) => {
    const next = [...new Set([...selected, ...ids])];
    if (ids.some((value) => !validModelId(value))) {
      setNotice("每个模型 ID 最多 160 个字符，且不能含控制字符。");
      return;
    }
    if (next.length > MODELS_PER_CONNECTION) {
      setNotice(`每份连接最多保存 ${MODELS_PER_CONNECTION} 个模型。`);
      return;
    }
    setNotice("");
    onChange(next);
    setEntry("");
  };
  const paste = (event: ClipboardEvent) => {
    const text = event.clipboardData.getData("text");
    if (!/[\r\n]/.test(text)) return;
    const ids = text.split(/\r?\n|\r/).map((value) => value.trim()).filter(Boolean);
    event.preventDefault();
    if (ids.length) add(ids);
  };
  const remove = (model: string) => {
    setNotice("");
    onChange(selected.filter((id) => id !== model));
  };
  const fetched = [...new Set(list?.models.filter(validModelId) ?? [])];
  const matches = fetched.filter((model) => model.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return <SettingsRow label="模型" description="同一连接的模型共用服务地址和密钥。在聊天时可以单独选择每个模型。"
    error={error} labelId={`${id}-label`} descriptionId={`${id}-description`} stacked>
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-body-2-medium text-text-secondary">已添加 {selected.length} 个模型</span>
        <Button type="button" variant="secondary" size="small" leadingIcon={ListIcon} disabled={list?.pending}
          onClick={() => { setQuery(""); onFetch(); }}>
          {list?.pending ? "正在连接…" : "连接并获取模型"}
        </Button>
      </div>
      {selected.length > 0 && <ul aria-label="已添加的模型" className="max-h-44 overflow-y-auto rounded-xl border border-separator-border bg-background-primary-default">
        {selected.map((model, index) => <li key={model} className="flex min-w-0 items-center gap-2 border-b border-separator-border px-2.5 py-1 last:border-b-0">
          <span translate="no" className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary" title={model}>{model}</span>
          {index === 0 ? <span className="shrink-0 text-caption-1-medium text-text-secondary">默认模型</span> :
            <Button type="button" variant="ghost" size="small" aria-label={`将 ${model} 设为默认`} onClick={() => {
              onChange([model, ...selected.filter((value) => value !== model)]);
            }}>设为默认</Button>}
          <IconButton type="button" icon={XIcon} size="small" aria-label={`移除模型 ${model}`} onClick={() => remove(model)} />
        </li>)}
      </ul>}
      <div className="flex flex-wrap items-center gap-2">
        <Input id={id} value={entry} onChange={setEntry} size="small" className="min-w-40 flex-1" autoComplete="off"
          placeholder="手动输入或粘贴多行模型 ID" aria-label="手动输入模型 ID" aria-describedby={`${id}-description`} isInvalid={Boolean(error || notice)}
          onPaste={paste} onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (entry.trim()) add([entry.trim()]);
          }} />
        <Button type="button" variant="secondary" size="small" leadingIcon={PlusIcon} disabled={!entry.trim()} onClick={() => add([entry.trim()])}>添加模型</Button>
      </div>
      {notice && <p role="alert" className="text-body-2-regular text-text-error-primary">{notice}</p>}
      {list && <p role="status" className={cx("text-body-2-regular", list.ok || list.pending ? "text-text-secondary" : "text-text-error-primary")}>{list.message}</p>}
      {fetched.length > 0 && <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend className="mb-1 text-body-2-medium text-text-primary">服务返回的模型</legend>
        {fetched.length > 8 && <Input size="small" type="search" aria-label="筛选返回的模型" placeholder="筛选返回的模型" value={query} onChange={setQuery} />}
        <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto rounded-xl border border-separator-border bg-background-primary-default p-1">
          {matches.map((model) => <Checkbox key={model} size="sm" isSelected={selected.includes(model)}
            className="min-w-0 rounded-lg px-2 py-1.5 hover:bg-background-primary-hover [&>span:last-child]:min-w-0"
            onChange={(checked) => checked ? add([model]) : remove(model)}>
            <span translate="no" className="block truncate" title={model}>{model}</span>
          </Checkbox>)}
          {!matches.length && <p className="px-2 py-1.5 text-body-2-regular text-text-secondary">没有匹配的模型。</p>}
        </div>
      </fieldset>}
    </div>
  </SettingsRow>;
}
