import { useState } from "react";
import { BookmarkIcon, UserIcon } from "@/components/foundations/icons/app-icons";
import { PillTab, PillTabList } from "@/components/base/tabs/pill-tab";
import { Chip } from "@/components/base/badges/chip";
import { ToolPanelMessage } from "../tools/tool-panel-frame";
import { cx } from "@/utils/cx";
import { useContacts } from "@/hooks/use-contacts";

/** Memory spaces: shared (公共) is global; contact:<id> belongs to that contact. */
type MemorySpace = "shared" | "contact";

/** Placeholder shape for a memory entry; real storage not yet implemented. */
interface MemoryEntry {
  id: string;
  content: string;
  contactId?: string;
  source: string;
  createdAt: number;
}

/** Compact age label: today / yesterday / N days / month-day. */
function memoryAge(ts: number, now: number): string {
  const diff = Math.floor((now - ts) / 86_400_000);
  if (diff <= 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff < 30) return `${diff} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** One row in the memory list — compact, like a trajectory row. */
function MemoryRow({ entry, contactName, now }: { entry: MemoryEntry; contactName?: string; now: number }) {
  const [expanded, setExpanded] = useState(false);
  const preview = expanded ? entry.content : entry.content.slice(0, 120) + (entry.content.length > 120 ? "…" : "");
  return (
    <li className="border-b border-separator-border last:border-b-0">
      <button
        type="button"
        className={cx(
          "group/mem flex w-full cursor-pointer flex-col items-stretch gap-1 px-4 py-2.5 text-start outline-none",
          "hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring",
        )}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 text-body-2-regular text-text-primary leading-snug">{preview}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {contactName && <Chip variant="caption" color="soft">{contactName}</Chip>}
          <span className="text-caption-1-regular text-text-tertiary">{entry.source}</span>
          <span className="ml-auto text-caption-1-regular text-text-tertiary">{memoryAge(entry.createdAt, now)}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * 记忆 view — user-confirmed long-term facts and preferences, organized by
 * space (公共记忆 shared; 角色记忆 per-contact) with a contact filter.
 * No data yet: storage and extraction are not implemented in M3.
 */
export function MemoryView() {
  const [space, setSpace] = useState<MemorySpace>("shared");
  const [contactFilter, setContactFilter] = useState<string>("all");
  const { contacts } = useContacts();
  const now = Date.now();

  // Real memory entries come from the database once MEM-01 is complete.
  const entries: MemoryEntry[] = [];

  const sharedEntries = entries.filter((e) => !e.contactId);
  const contactEntries = entries.filter((e) => !!e.contactId);
  const visibleEntries = space === "shared"
    ? sharedEntries
    : contactFilter === "all"
      ? contactEntries
      : contactEntries.filter((e) => e.contactId === contactFilter);

  // Build contact list for filter chips (only contacts that have memories or all if none).
  const activeContacts = contacts.filter((c) => contactEntries.some((e) => e.contactId === c.id));
  const filterContacts = activeContacts.length > 0 ? activeContacts : contacts;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Space switcher */}
      <div className="flex shrink-0 items-center gap-2 border-b border-separator-border px-3 py-2">
        <PillTabList role="group" aria-label="记忆空间" className="gap-0.5">
          <PillTab variant="gray" isSelected={space === "shared"} onSelect={() => setSpace("shared")}>
            公共记忆
          </PillTab>
          <PillTab variant="gray" icon={UserIcon} isSelected={space === "contact"} onSelect={() => { setSpace("contact"); setContactFilter("all"); }}>
            角色记忆
          </PillTab>
        </PillTabList>
        {visibleEntries.length > 0 && (
          <span className="ml-auto text-caption-1-regular text-text-tertiary">{visibleEntries.length} 条</span>
        )}
      </div>

      {/* Contact filter — only shown in 角色记忆 when there are contacts */}
      {space === "contact" && filterContacts.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-separator-border px-3 py-2">
          <button
            type="button"
            onClick={() => setContactFilter("all")}
            className={cx(
              "rounded-md px-2 py-0.5 text-caption-1-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              contactFilter === "all"
                ? "bg-background-secondary-default text-text-primary"
                : "text-text-tertiary hover:bg-background-primary-hover hover:text-text-secondary",
            )}
          >
            全部
          </button>
          {filterContacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => setContactFilter(contact.id)}
              className={cx(
                "rounded-md px-2 py-0.5 text-caption-1-medium outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                contactFilter === contact.id
                  ? "bg-background-secondary-default text-text-primary"
                  : "text-text-tertiary hover:bg-background-primary-hover hover:text-text-secondary",
              )}
            >
              {contact.name}
            </button>
          ))}
        </div>
      )}

      {/* Memory list */}
      {visibleEntries.length === 0 ? (
        <ToolPanelMessage
          icon={BookmarkIcon}
          title={space === "shared" ? "还没有公共记忆" : "还没有角色记忆"}
          detail={
            space === "shared"
              ? "与角色交流后，你确认的偏好和重要事实会出现在这里。"
              : "每位角色有自己的记忆空间，切换到某位角色后，对应的偏好和事实会出现在这里。"
          }
        />
      ) : (
        <ol aria-label={space === "shared" ? "公共记忆" : "角色记忆"} className="min-h-0 flex-1 overflow-y-auto">
          {visibleEntries.map((entry) => {
            const contactName = entry.contactId
              ? contacts.find((c) => c.id === entry.contactId)?.name
              : undefined;
            return <MemoryRow key={entry.id} entry={entry} contactName={contactName} now={now} />;
          })}
        </ol>
      )}
    </div>
  );
}
