import { initialState } from "../../src/app/workspace-model";
import { WorkspaceStore } from "../../src/app/state";
import type { ContentKind } from "../../src/app/workspace-model";

export interface WorkPreview {
  id: string;
  title: string;
  kind: ContentKind;
  groupId: string;
  summary: string;
  when: string;
  label: string;
  paragraphs: string[];
  goal?: string;
  files?: string[];
}
export interface ReviewPreview {
  id: string;
  workId: string;
  title: string;
  summary: string;
  path: string;
  body: string;
}

// Explicit fixtures for this isolated HTML preview; never loaded by src/main.ts.
const workExamples: WorkPreview[] = [
  { id: "preview-coding", title: "NekoPapa 导航整理", kind: "coding", groupId: "preview-project", summary: "梳理侧栏交互，整理下一轮需要修改的地方。", when: "20 分钟前", label: "NekoPapa", paragraphs: ["保持分类导航与内容标签相互独立。", "下一步核对窄窗口布局、关闭标签后的焦点，以及需要确认的文件变更。"] },
  { id: "preview-research", title: "Agent 产品交互研究", kind: "conversation", groupId: "preview-space", summary: "从任务发起、执行反馈到结果组织，整理设计思路。", when: "1 小时前", label: "产品研究", paragraphs: ["首页需要帮助用户开始工作，也需要让用户快速回到正在做的事。", "需要确认的操作集中呈现，并提供具体范围、返回原任务和取消入口。"] },
  { id: "preview-plan", title: "本周工作计划", kind: "page", groupId: "preview-space", summary: "把想做的事排出先后顺序，保留可执行的下一步。", when: "昨天", label: "我的空间", paragraphs: ["先完成首页与任务发起体验，再验证真实模型调用。", "每一轮保留输入、取消、失败和恢复的完整流程。"] },
  { id: "preview-notes", title: "会议记录摘要", kind: "page", groupId: "preview-space", summary: "三个决定、两项待办，以及需要补齐的信息。", when: "昨天", label: "我的空间", paragraphs: ["决定：先确定首页的信息结构，使用 HTML 原型验证。", "待办：确认目标输入、最近工作和待处理区域的优先级。"] },
];
const reviewExamples: ReviewPreview[] = [
  { id: "preview-write", workId: "preview-notes", title: "保存会议摘要", summary: "将整理好的内容保存到我的空间。", path: "notes/meeting-summary.md", body: "# 会议记录摘要\n\n## 已确定\n- 首页采用普通工作台页面\n- 桌面人物使用独立窗口\n\n## 下一步\n- 核对任务输入与最近工作\n- 验证首次使用的空状态" },
  { id: "preview-code-review", workId: "preview-coding", title: "审阅导航修改", summary: "两处界面调整，等待你查看后继续。", path: "src/app/navigation.ts", body: "待审阅的示例变更\n\n1. 关闭当前标签后，焦点回到相邻标签。\n2. 窄窗口下，标签列表可以横向滚动。\n\n此处只展示审阅界面，不会修改项目文件。" },
];

export function createPreview(daily: boolean) {
  const works = daily ? structuredClone(workExamples) : [];
  const reviews = daily ? structuredClone(reviewExamples) : [];
  const state = initialState();
  state.pinnedFeatures = [];
  if (daily) {
    state.groups = [{ id: "preview-space", title: "我的空间", kind: "space" }, { id: "preview-project", title: "NekoPapa", kind: "project" }];
    state.items = works.map(({ id, title, kind, groupId }) => ({ id, title, kind, groupId }));
    state.recent = works.map((work) => work.id);
    state.favorites = ["preview-plan"];
  }
  let serialized = JSON.stringify(state);
  const store = new WorkspaceStore({ getItem: () => serialized, setItem: (_key, value) => { serialized = value; } });
  return { store, works, reviews };
}

export const suggestions = {
  research: { mode: "conversation", text: "帮我整理这份资料，提炼核心观点、关键依据和接下来可以做的事。" },
  plan: { mode: "conversation", text: "帮我梳理这周要完成的事情，排出优先级，拆成明确的下一步。" },
  thinking: { mode: "conversation", text: "帮我分析这个问题：先澄清目标和约束，再比较几种可行的方案。" },
  coding: { mode: "coding", text: "先了解项目结构，再和我一起梳理要修改的地方及验证方式。" },
} as const;
