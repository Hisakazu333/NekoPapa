import "./screen-island.css";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ArrowUpRightIcon, FolderOpenIcon, NotebookPenIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Input } from "@/components/base/input/input";
import { Textarea } from "@/components/base/textarea/textarea";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { desktopToolError, desktopTools, type NoteKind } from "@/app/desktop/desktop-tools";

type Notice = { text: string; error?: boolean };

export function ScreenIsland() {
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState<NoteKind>("study");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<string>();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const titleField = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  const resize = async (next: boolean) => {
    await desktopTools.expandIsland(next);
    setExpanded(next);
    if (next) requestAnimationFrame(() => titleField.current?.focus());
  };
  const run = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setNotice(undefined);
    try { await action(); }
    catch (error) {
      const text = desktopToolError(error);
      if (expanded) setNotice({ text, error: true });
      else void desktopTools.captureFeedback(text).catch(() => undefined);
    }
    finally { busy.current = false; setPending(false); }
  };
  const dismiss = async () => {
    await resize(false);
    setPreview(undefined);
    setTitle("");
    setBody("");
    setKind("study");
  };
  const close = () => void run(dismiss);
  const capture = () => void run(async () => {
    let openedEditor = false;
    try {
      const root = document.documentElement;
      const animate = root.dataset.reducedMotion !== "true" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const result = await desktopTools.capture(animate, root.classList.contains("dark"));
      if (result.status !== "captured") return;
      setPreview(result.preview);
      const text = result.text?.trim();
      setBody(text?.slice(0, 64_000) ?? "");
      setNotice({ text: text ? "已填入识别结果，可以修改后保存。"
        : result.text === null ? "识字未完成，可以参照截图手动填写。" : "选区没有识别到文字，可以参照截图填写。" });
      await resize(true);
      openedEditor = true;
    } finally {
      if (!openedEditor) await desktopTools.expandIsland(false);
    }
  });

  const onPull = useEffectEvent(() => { if (!expanded) capture(); });
  useEffect(() => {
    let active = true;
    const initializationFailed = () => {
      if (active) void desktopTools.captureFeedback("屏幕取材尚未准备好，请停用手势后重新启用。").catch(() => undefined);
    };
    const listener = getCurrentWebviewWindow().listen("screen-notebook:pull", () => {
      if (active) onPull();
    }).then((unlisten) => {
      if (active) void desktopTools.expandIsland(false).catch(initializationFailed);
      return unlisten;
    }).catch(initializationFailed);
    return () => { active = false; void listener.then((unlisten) => unlisten?.()); };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy.current) close();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [expanded]);

  if (!expanded) return null;

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
      <IconButton size="small" aria-label="关闭截图编辑" icon={XIcon} disabled={pending} onClick={close} />
    </header>
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
    </div>}
    <footer className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-1.5 border-t border-separator-border pt-3">
      <IconButton size="small" aria-label="在访达打开笔记目录" icon={FolderOpenIcon} disabled={pending}
        onClick={() => void run(desktopTools.openNotes)} />
      <div className="flex gap-1.5">
        <Button size="small" variant="secondary" leadingIcon={ArrowUpRightIcon} disabled={pending || !body.trim()}
          onClick={() => void run(async () => {
            await desktopTools.toChat(kind, body);
            await dismiss();
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
