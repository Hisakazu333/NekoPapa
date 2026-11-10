import { useMemo, useState, type ReactNode } from "react";
import { FolderIcon } from "@/components/foundations/icons/app-icons";
import { profileActivity } from "@/app/profile-activity";
import { resolveProject } from "@/app/projects";
import { useProjects } from "@/hooks/use-projects";
import { useChatHistory } from "@/hooks/use-chat-history";
import { ProfileHeatmap } from "./profile-heatmap";

function StatTile({ label, value, unit, note }: { label: string; value: number; unit?: string; note?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-background-secondary-default p-3.5">
      <p className="text-body-2-regular text-text-secondary">{label}</p>
      <p className="flex items-baseline gap-1">
        <span className="text-title-2-semibold tabular-nums text-text-primary">{value.toLocaleString()}</span>
        {unit && <span className="text-body-2-regular text-text-secondary">{unit}</span>}
      </p>
      {note && <p className="text-caption-1-regular text-text-tertiary">{note}</p>}
    </div>
  );
}

/**
 * 本机使用: totals, a year of activity, a link to token usage (消耗统计) and the most used project
 * folders, all read from chat history on this device. Activity counts only
 * messages you sent.
 */
export function ProfileActivityCard() {
  const history = useChatHistory();
  // The page shows a snapshot; reopening settings picks up a new day.
  const [now] = useState(() => Date.now());
  const { projects } = useProjects();
  const activity = useMemo(
    () => profileActivity(history.threads, now, { projectKey: (value) => resolveProject(projects, value)?.id }),
    [history.threads, now, projects],
  );
  const projectOf = (id: string) => projects.find((project) => project.id === id);
  const empty = activity.sentMessages === 0;

  return (
    <section aria-labelledby="profile-activity-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
        <h3 id="profile-activity-title" className="text-body-medium text-text-primary">本机使用</h3>
        <p className="text-body-2-regular text-text-tertiary">来自此设备的聊天记录，不会上传</p>
      </div>
      {!history.ready
        ? <p role="status" className="rounded-2xl bg-background-secondary-default p-4 text-body-regular text-text-secondary">正在读取本机聊天记录…</p>
        : history.error && history.threads.length === 0
          ? <p role="alert" className="rounded-2xl bg-background-secondary-default p-4 text-body-regular text-text-error-primary">{history.error}</p>
          : <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="对话" value={activity.conversations} />
              <StatTile label="发送的消息" value={activity.sentMessages} />
              <StatTile label="活跃天数" value={activity.activeDays} unit="天" note="近一年" />
              <StatTile label="最长连续" value={activity.longestStreak} unit="天" note={`当前连续 ${activity.currentStreak} 天`} />
            </div>
            <ProfileHeatmap activity={activity} />
            {empty && <p className="px-1 text-body-2-regular text-text-tertiary">发送第一条消息后，这里会记录你的活跃日。</p>}
            {activity.projects.length > 0 && <div className="flex flex-col gap-1.5">
              <p className="px-1 text-body-2-medium text-text-secondary">常用项目</p>
              <ul className="flex flex-col rounded-2xl bg-background-secondary-default ps-3">
                {activity.projects.map((entry) => {
                  const project = projectOf(entry.key);
                  return <li key={entry.key}
                    className="flex min-h-12 items-center gap-3 border-b border-border-button-default py-2 pe-3 last:border-b-0">
                    <FolderIcon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span translate="no" className="truncate text-body-medium text-text-primary">{project?.name ?? entry.key}</span>
                      {project && <span translate="no" className="truncate text-caption-1-regular text-text-tertiary">{project.folders[0]}</span>}
                    </span>
                    <span className="shrink-0 text-body-2-regular tabular-nums text-text-secondary">{entry.conversations} 个对话</span>
                  </li>;
                })}
              </ul>
            </div>}
            {history.error && <p role="alert" className="px-1 text-body-2-regular text-text-error-primary">{history.error}</p>}
          </>}
    </section>
  );
}
