import { useMemo, useState } from "react";
import { resolveProject } from "@/app/projects/projects";
import { collectUsageReplies, usageOverview, type UsageSource } from "@/app/usage/usage-stats";
import type { StoredThread } from "@/components/application/agent-chat/thread-storage";
import { Button } from "@/components/base/buttons/button";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { useChatHistory } from "@/hooks/use-chat-history";
import { useProjects } from "@/hooks/use-projects";
import { UsageContributionsCard } from "./usage-contributions-card";
import { UsageSankeyCard } from "./usage-sankey-card";

/**
 * 消耗统计: token usage recorded by replies on this device — a yearly
 * contributions card and where the tokens went (source → model). Nothing is
 * estimated or uploaded; replies without recorded usage are absent.
 */
export function UsageSettingsPanel({ onClose }: { onClose: () => void }) {
  const history = useChatHistory();
  const { projects } = useProjects();
  // The page shows a snapshot; reopening settings picks up a new day.
  const [now] = useState(() => Date.now());
  const replies = useMemo(() => {
    const sourceOf = (thread: StoredThread): UsageSource => {
      if (thread.contact) return { key: "contacts", label: "联系人" };
      const project = resolveProject(projects, thread.project);
      return project ? { key: project.id, label: project.name } : { key: "no-project", label: "未归入项目" };
    };
    return collectUsageReplies(history.threads, sourceOf);
  }, [history.threads, projects]);
  const overview = useMemo(() => usageOverview(replies, now), [replies, now]);

  return (
    <>
      <ModalBody>
        <div className="flex flex-col gap-4">
          {!history.ready
            ? <p role="status" className="text-body-2-regular text-text-tertiary">正在读取本机聊天记录…</p>
            : <>
              {replies.length === 0 && <p className="rounded-2xl bg-background-secondary-default px-4 py-3 text-body-2-regular text-text-secondary">
                还没有记录到 Token 用量。使用已连接的模型收到回复后，这里会按天和模型统计。
              </p>}
              <UsageContributionsCard replies={replies} overview={overview} now={now} />
              <UsageSankeyCard replies={replies} now={now} />
            </>}
          {history.error && <p role="alert" className="text-body-2-regular text-text-error-primary">{history.error}</p>}
          <p className="px-1 text-caption-1-regular text-text-tertiary">按模型服务返回的用量统计，只计入记录了用量的回复；更新前的回复、群聊回复，以及不返回用量的服务都不计入。数据只在此设备上。</p>
        </div>
      </ModalBody>
      <ModalFooter><Button variant="secondary" onClick={onClose}>关闭</Button></ModalFooter>
    </>
  );
}
