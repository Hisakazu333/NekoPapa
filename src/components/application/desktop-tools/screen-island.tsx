import "./screen-island.css";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRightIcon, CameraIcon, ChevronUpIcon, FolderOpenIcon, NotebookPenIcon, SettingsIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Input } from "@/components/base/input/input";
import { Textarea } from "@/components/base/textarea/textarea";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { desktopToolError, desktopTools, ISLAND_WINDOW, type NoteKind } from "@/app/desktop/desktop-tools";

type Notice = { text: string; error?: boolean; permission?: boolean };

export function ScreenIsland() {
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState<NoteKind>("study");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<string>();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const trigger = useRef<HTMLButtonElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  const resize = async (next: boolean) => {
    await desktopTools.expandIsland(next);
    setExpanded(next);
    requestAnimationFrame(() => (next ? titleField : trigger).current?.focus());
  };
  const run = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setNotice(undefined);
    try { await action(); }
    catch (error) { setNotice({ text: desktopToolError(error), error: true }); }
    finally { busy.current = false; setPending(false); }
  };
  const close = () => void run(() => desktopTools.close(ISLAND_WINDOW));
  const collapse = () => void run(() => resize(false));
  const capture = () => void run(async () => {
    const root = document.documentElement;
    const animate = root.dataset.reducedMotion !== "true" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const result = await desktopTools.capture(animate, root.classList.contains("dark"));
    if (result.status === "permissionRequired") {
      setNotice({ text: "请在系统设置中允许 NekoPapa 录制屏幕，然后重试。", permission: true });
      return;
    }
    if (result.status === "cancelled") {
      (expanded ? titleField : trigger).current?.focus();
      return;
    }
    setPreview(result.preview);
    const text = result.text?.trim();
    if (text) {
      setBody((previous) => (previous.trim() ? `${previous}\n\n${text}` : text).slice(0, 64_000));
      setNotice({ text: "已填入识别结果，可以修改后保存。" });
    } else {
      setNotice({ text: result.text === null ? "识字未完成，可以参照截图手动填写。" : "选区没有识别到文字，可以参照截图填写。" });
    }
    if (!expanded) await resize(true);
  });

  useEffect(() => {
    if (!expanded) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy.current) collapse();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [expanded]);

  if (!expanded) {
    const iconClass = "size-6 rounded-full text-text-white/75 hover:bg-white/15 hover:text-text-white";
    return <div className="flex h-full items-center justify-center gap-0.5 rounded-b-2xl bg-neutral-950 px-1.5 text-text-white">
      <Button ref={trigger} size="xs" variant="ghost" className="min-w-0 flex-1 rounded-full text-text-white hover:bg-white/15"
        aria-label="截取屏幕" title={notice?.text ?? "从灵动岛开始截图"} leadingIcon={CameraIcon}
        disabled={pending} onClick={capture}>{pending ? "框选中…" : notice?.error ? "重试截图" : "截取屏幕"}</Button>
      {notice?.permission && <Button size="xs" iconOnly variant="ghost" leadingIcon={SettingsIcon}
        aria-label="打开屏幕录制设置" title={notice.text} className={iconClass} onClick={() => void run(desktopTools.permissionSettings)} />}
      {(preview || title || body) && <Button size="xs" iconOnly variant="ghost" leadingIcon={NotebookPenIcon}
        aria-label="继续编辑截图" title="继续编辑截图" className={iconClass} disabled={pending} onClick={() => void run(() => resize(true))} />}
      <Button size="xs" iconOnly variant="ghost" leadingIcon={XIcon} aria-label="关闭灵动岛" title="关闭灵动岛"
        className={iconClass} disabled={pending} onClick={close} />
      {notice && <span role={notice.error ? "alert" : "status"} className="sr-only">{notice.text}</span>}
    </div>;
  }

  return <section aria-label="NekoPapa 屏幕取材"
    className="screen-island-panel relative flex h-dvh flex-col gap-3 overflow-auto rounded-3xl border border-border-button-default bg-background-primary-default p-4 text-text-primary">
    <header className="flex shrink-0 items-center gap-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default">
        <NotebookPenIcon className="size-4 text-foreground-icon-primary" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-body-medium">屏幕取材</h1>
        <p className="text-caption-1-regular text-text-secondary">框选屏幕内容，识字在本机完成</p>
      </div>
      <IconButton size="small" aria-label="收起灵动岛" icon={ChevronUpIcon} disabled={pending} onClick={collapse} />
      <IconButton size="small" aria-label="关闭灵动岛" icon={XIcon} disabled={pending} onClick={close} />
    </header>
    <Button variant="secondary" size="small" leadingIcon={CameraIcon} disabled={pending}
      onClick={capture}>{pending ? "处理中…" : "再截一张"}</Button>
    {preview && <figure className="relative shrink-0 rounded-xl border border-separator-border bg-background-secondary-default p-2">
      <img src={preview} alt="本次选区截图" className="mx-auto max-h-44 w-full object-contain" />
      <IconButton size="small" className="absolute end-2 top-2" aria-label="移除截图预览" icon={XIcon}
        onClick={() => setPreview(undefined)} />
    </figure>}
    <SegmentedControl aria-label="保存类型" selectedKeys={[kind]} onSelectionChange={(keys) => {
      const next = [...keys][0];
      if (next === "study" || next === "code") setKind(next);
    }}>
      <SegmentedControlItem id="study">学习笔记</SegmentedControlItem>
      <SegmentedControlItem id="code">代码草稿</SegmentedControlItem>
    </SegmentedControl>
    <Input ref={titleField} size="small" aria-label="标题" placeholder={kind === "study" ? "笔记标题" : "代码草稿标题"}
      value={title} onChange={setTitle} maxLength={100} />
    <Textarea size="small" aria-label="识别结果与正文" placeholder="识别结果会填在这里，也可以直接编辑。"
      value={body} onChange={setBody} rows={5} resize="none" maxLength={64_000} />
    {notice && <div className="flex flex-wrap items-center gap-1.5">
      <p role={notice.error ? "alert" : "status"} className={notice.error ? "text-body-2-regular text-text-error-primary" : "text-body-2-regular text-text-secondary"}>{notice.text}</p>
      {notice.permission && <Button size="xs" variant="secondary" onClick={() => void run(desktopTools.permissionSettings)}>打开系统设置</Button>}
    </div>}
    <footer className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-1.5 border-t border-separator-border pt-3">
      <IconButton size="small" aria-label="在访达打开笔记目录" icon={FolderOpenIcon} disabled={pending}
        onClick={() => void run(desktopTools.openNotes)} />
      <div className="flex gap-1.5">
        <Button size="small" variant="secondary" leadingIcon={ArrowUpRightIcon} disabled={pending || !body.trim()}
          onClick={() => void run(async () => {
            await desktopTools.toChat(kind, body);
            await resize(false);
          })}>交给工作台</Button>
        <Button size="small" disabled={pending || !title.trim() || !body.trim()}
          onClick={() => void run(async () => {
            const path = await desktopTools.saveNote(kind, title, body);
            setNotice({ text: `已保存 ${path.split("/").at(-1)}` });
          })}>保存 Markdown</Button>
      </div>
    </footer>
  </section>;
}
