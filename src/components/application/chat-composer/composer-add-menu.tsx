import { useId, useRef, useState } from "react";
import { RiAddLine, RiAttachment2, RiArrowLeftSLine, RiCheckLine, RiFolderLine, RiFocus3Line, RiListCheck3 } from "@remixicon/react";
import { Dropdown, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { Button } from "@/components/base/buttons/button";
import { composerArtifacts, COMPOSER_GOAL_LIMIT, validateComposerGoal, type ComposerArtifact } from "@/app/chat-composer-draft";
import type { ChatComposerState } from "@/hooks/use-chat-composer";
import { cx } from "@/utils/cx";

export function ComposerAddMenu({ state, disabled, className, official = false }: { state: ChatComposerState; disabled?: boolean; className?: string; official?: boolean }) {
  const goalId = useId();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"main" | "files" | "goal">("main");
  const [goal, setGoal] = useState("");
  const [goalError, setGoalError] = useState<string>();
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const changeOpen = (next: boolean) => { setOpen(next); if (!next) { setView("main"); setGoalError(undefined); } };
  const receiveFiles = (input: HTMLInputElement) => {
    state.addFiles(Array.from(input.files ?? []));
    input.value = "";
    changeOpen(false);
  };
  return <>
    <input ref={filesRef} type="file" multiple aria-label="选择聊天文件" className="hidden" onChange={(event) => receiveFiles(event.target)} />
    <input ref={(input) => { folderRef.current = input; input?.setAttribute("webkitdirectory", ""); }} type="file" multiple aria-label="选择聊天文件夹" className="hidden" onChange={(event) => receiveFiles(event.target)} />
    <Dropdown isOpen={open} onOpenChange={changeOpen}>
      <DropdownTrigger aria-label="添加到聊天" isDisabled={disabled} className={cx("flex size-9 shrink-0 items-center justify-center rounded-full bg-ai-chat-composer-add-background text-foreground-icon-primary hover:bg-background-tertiary-default disabled:opacity-50", className)}>
        <RiAddLine className={cx("size-5 transition-transform motion-reduce:transition-none", open && "rotate-45")} aria-hidden />
      </DropdownTrigger>
      <DropdownPopover aria-label={view === "goal" ? "设置聊天目标" : "添加到聊天"} placement="top start" className="w-[365px] max-w-[calc(100vw-32px)] rounded-2xl" dialogClassName="max-h-[70dvh] overflow-y-auto">
        {view === "main" ? <>
          <DropdownGroup label="添加">
            <DropdownItem className="py-1.5" onSelect={() => setView("files")}><RiAttachment2 className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden /><span className="truncate text-body-medium">文件和文件夹</span></DropdownItem>
            {!official && <>
              <DropdownItem className="py-1.5" selected={Boolean(state.draft.goal)} onSelect={() => { setGoal(state.draft.goal); setView("goal"); }}><RiFocus3Line className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden /><span className="truncate text-body-medium">目标 <span className="text-text-secondary">设定本次任务目标</span></span></DropdownItem>
              <DropdownItem className="py-1.5" selected={state.draft.planning} onSelect={() => { state.setDraft((draft) => ({ ...draft, planning: !draft.planning })); changeOpen(false); }}><RiListCheck3 className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden /><span className="min-w-0 flex-1 truncate text-body-medium">计划模式 <span className="text-text-secondary">先规划复杂任务</span></span>{state.draft.planning && <RiCheckLine className="size-4 shrink-0" aria-hidden />}</DropdownItem>
            </>}
          </DropdownGroup>
          {!official && <DropdownGroup label="插件">
            {composerArtifacts.map((artifact) => <DropdownItem className="py-1.5" key={artifact.id} selected={state.draft.artifact === artifact.id} onSelect={() => { state.setDraft((draft) => ({ ...draft, artifact: draft.artifact === artifact.id ? null : artifact.id })); changeOpen(false); }}>
              <ArtifactIcon name={artifact.id} /><span className="min-w-0 flex-1 truncate text-body-medium">{artifact.label} <span className="text-text-secondary">{artifact.description}</span></span>{state.draft.artifact === artifact.id && <RiCheckLine className="size-4 shrink-0" aria-hidden />}
            </DropdownItem>)}
          </DropdownGroup>}
        </> : view === "files" ? <>
          <Back onClick={() => setView("main")} />
          <DropdownItem onSelect={() => filesRef.current?.click()}><RiAttachment2 className="size-5" aria-hidden />选择文件</DropdownItem>
          <DropdownItem onSelect={() => folderRef.current?.click()}><RiFolderLine className="size-5" aria-hidden />选择文件夹</DropdownItem>
          <p className="p-2 text-caption-1-regular text-text-tertiary">最多 10 个文件，每个不超过 10 MB，总计不超过 25 MB。文件暂存当前草稿，尚未上传。</p>
        </> : <>
          <Back onClick={() => setView("main")} />
          <label htmlFor={goalId} className="px-2 pt-1 text-body-medium">本次聊天目标</label>
          <textarea id={goalId} aria-label="聊天目标" autoFocus value={goal} maxLength={COMPOSER_GOAL_LIMIT} onChange={(event) => { setGoal(event.target.value); setGoalError(undefined); }} rows={4} placeholder="例如：理解这节课的核心概念，并完成三道练习。" className="m-1 resize-none rounded-xl bg-background-secondary-default p-3 text-body-regular outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring" />
          <p className="px-2 text-right text-caption-1-regular text-text-tertiary">{goal.length}/{COMPOSER_GOAL_LIMIT}</p>
          {goalError && <p role="alert" className="px-2 text-caption-1-regular text-text-error-primary">{goalError}</p>}
          <div className="flex justify-end gap-2 px-1 pt-2"><Button variant="secondary" size="small" onClick={() => changeOpen(false)}>取消</Button><Button size="small" onClick={() => {
            const validated = validateComposerGoal(goal);
            if (validated.error) { setGoalError(validated.error); return; }
            state.setDraft((draft) => ({ ...draft, goal: validated.goal ?? "" })); changeOpen(false);
          }}>保存目标</Button></div>
        </>}
      </DropdownPopover>
    </Dropdown>
  </>;
}

function Back({ onClick }: { onClick: () => void }) {
  return <button type="button" className="flex cursor-pointer items-center gap-1 rounded-lg px-1 py-2 text-caption-1-regular text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring" onClick={onClick}><RiArrowLeftSLine className="size-4" aria-hidden />返回添加菜单</button>;
}

function ArtifactIcon({ name }: { name: ComposerArtifact }) {
  const asset: Record<ComposerArtifact, string> = {
    document: "documents",
    spreadsheet: "spreadsheets",
    presentation: "presentations",
    code: "codeblocks",
  };
  return name === "document" ? <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden>
    <img src="/boardui/ai-chat/plugin-documents.svg" alt="" className="size-6 object-contain dark:hidden" />
    <img src="/boardui/ai-chat/plugin-documents-dark.svg" alt="" className="hidden h-6 w-auto object-contain dark:block" />
  </span> : <img src={`/boardui/ai-chat/plugin-${asset[name]}.svg`} alt="" aria-hidden className="size-6 shrink-0 object-contain" />;
}
