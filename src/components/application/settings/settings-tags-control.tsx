import { useState } from "react";
import { RiAddLine } from "@remixicon/react";
import type { ConfigurationField } from "@/app/configuration-types";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Tag, TagGroup } from "@/components/base/tag-group/tag-group";

export const parseTags = (value: string) => value.split("\n").map((entry) => entry.trim()).filter(Boolean);

/**
 * Removable BoardUI tags with an add field. The stored value stays the
 * newline-separated text the schema validates, so old textarea data loads
 * unchanged.
 */
export function TagsControl({ field, id, value, aria, onChange }: {
  field: ConfigurationField;
  id: string;
  value: string;
  aria: Record<string, string | undefined>;
  onChange: (value: string) => void;
}) {
  const tags = parseTags(value);
  const [entry, setEntry] = useState("");
  const [notice, setNotice] = useState("");
  const add = () => {
    const next = entry.trim();
    if (!next) return;
    if (tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) { setNotice(`“${next}”已在列表中。`); return; }
    const joined = [...tags, next].join("\n");
    if (field.maxLength && joined.length > field.maxLength) { setNotice(`列表最多 ${field.maxLength} 个字符。`); return; }
    onChange(joined);
    setEntry("");
    setNotice("");
  };
  return <div className="flex flex-col gap-2">
    <TagGroup aria-labelledby={aria["aria-labelledby"]} items={tags.map((tag) => ({ id: tag }))} size="small" emptyState="尚未添加"
      onRemove={(keys) => { onChange(tags.filter((tag) => !keys.has(tag)).join("\n")); setNotice(""); }}>
      {(item) => <Tag id={item.id} textValue={item.id}>{item.id}</Tag>}
    </TagGroup>
    <div className="flex min-w-0 items-center gap-2">
      <Input id={id} aria-label={`添加${field.label}`} value={entry} size="small" placeholder="输入名称后按 Enter" className="w-60"
        onChange={(next) => { setEntry(next); setNotice(""); }} aria-describedby={aria["aria-describedby"]}
        onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); add(); } }} />
      <Button variant="secondary" size="small" leadingIcon={RiAddLine} onClick={add} disabled={!entry.trim()}>添加</Button>
    </div>
    {notice && <p role="alert" className="text-body-2-regular text-text-error-primary">{notice}</p>}
  </div>;
}
