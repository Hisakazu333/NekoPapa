import { memo, useMemo, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import { motion, useReducedMotion } from "motion/react";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { ImageIcon } from "@/components/foundations/icons/app-icons";
import { normalizeMathDelimiters } from "@/app/chat/message-blocks";
import { splitMarkdownBlocks } from "@/app/chat/markdown-blocks";
import { cx } from "@/utils/cx";
import { useOpenMessageLink } from "./message-links";

/**
 * The prose of a reply as Markdown (GitHub flavour: headings, emphasis,
 * lists, task lists, quotes, tables, strikethrough, autolinks) plus LaTeX
 * math through KaTeX. Raw HTML in the reply is not rendered. Links open
 * through the transcript's link opener (设置 → 浏览器); images load only
 * from https addresses, without a referrer, and fall back to a link.
 * Fenced code never reaches here: the reply is split first (message-blocks).
 */
export const MessageMarkdown = memo(function MessageMarkdown({ text }: { text: string }) {
  // Each top-level block renders on its own, so while a reply streams only
  // the last block is parsed and typeset again (formulas are the costly part).
  const blocks = useMemo(() => splitMarkdownBlocks(normalizeMathDelimiters(text)), [text]);
  return <div translate="no" className="flex min-w-0 flex-col gap-3 text-body-regular break-words text-text-primary">
    {blocks.map((block, index) => <MarkdownBlock key={index} text={block} />)}
  </div>;
});

const REMARK = [remarkGfm, remarkMath];
const REHYPE: Options["rehypePlugins"] = [[rehypeKatex, { throwOnError: false, strict: "ignore", trust: false }]];

const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={REMARK} rehypePlugins={REHYPE} components={COMPONENTS} skipHtml>{text}</ReactMarkdown>;
});

/*
 * Each paragraph softens in once as it first appears and then only grows:
 * react-markdown keeps a paragraph's element while later tokens extend it, so
 * nothing on screen restarts. Animating words looks worse (a fragment blurs in,
 * then mutates to the word with no transition). The targets live at module
 * scope so Motion does not re-evaluate them on every token. Evenness of the
 * text itself comes from the server (`smoothStream` in the route).
 */
const LINE_HIDDEN = { opacity: 0, filter: "blur(5px)", y: 4 };
const LINE_SHOWN = { opacity: 1, filter: "blur(0px)", y: 0 };
const LINE_TRANSITION = { duration: 0.42, ease: [0.22, 0.61, 0.36, 1] } as const;

function Paragraph(props: ComponentPropsWithoutRef<"p">) {
  const reduceMotion = useReducedMotion();
  const { onAnimationStart: _a, onDrag: _d, onDragStart: _ds, onDragEnd: _de, ...rest } = props;
  return <motion.p {...rest} initial={reduceMotion ? false : LINE_HIDDEN} animate={LINE_SHOWN} transition={LINE_TRANSITION} />;
}

type Props<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithoutRef<T> & { node?: unknown };
const strip = <T extends { node?: unknown }>({ node: _node, ...rest }: T) => rest;

function Link({ href, children, ...rest }: Props<"a">) {
  const open = useOpenMessageLink();
  const safe = href && /^(https?:|mailto:)/i.test(href) ? href : undefined;
  if (!safe) return <span>{children}</span>;
  return <a {...strip(rest)} href={safe} onClick={(event) => { event.preventDefault(); if (!safe.startsWith("mailto:")) open(safe); else window.location.href = safe; }}
    className="text-text-primary underline decoration-text-tertiary underline-offset-2 hover:decoration-text-primary">{children}</a>;
}

function Picture({ src, alt }: Props<"img">) {
  const [failed, setFailed] = useState(false);
  const url = typeof src === "string" && /^https:\/\//i.test(src) ? src : undefined;
  if (!url || failed) {
    return <span className="inline-flex items-center gap-1 text-caption-1-regular text-text-tertiary"><ImageIcon className="size-3.5" aria-hidden />
      {url ? <Link href={url}>{alt || "图片"}（无法显示）</Link> : `${alt || "图片"}（只显示 https 图片）`}</span>;
  }
  return <img src={url} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}
    className="my-1 block h-auto max-h-[480px] max-w-full rounded-xl border border-separator-border" />;
}

/** Headings keep the reply's scale: the transcript already has its own page title. */
const heading = (level: number, className: string) => (props: Props<"h1">) =>
  <p role="heading" aria-level={level} {...strip(props)} className={cx("mt-1 text-text-primary", className)} />;

const COMPONENTS: Components = {
  p: (props) => <Paragraph {...strip(props)} />,
  h1: heading(1, "text-title-3-semibold"),
  h2: heading(2, "text-headline-semibold"),
  h3: heading(3, "text-body-semibold"),
  h4: heading(4, "text-body-semibold"),
  h5: heading(5, "text-body-2-semibold"),
  h6: heading(6, "text-body-2-semibold"),
  a: Link,
  img: Picture,
  strong: (props) => <strong {...strip(props)} className="font-semibold" />,
  ul: ({ className, ...props }) => <ul {...strip(props)} className={cx("flex flex-col gap-1 ps-5", className?.includes("contains-task-list") ? "list-none ps-1" : "list-disc")} />,
  ol: (props) => <ol {...strip(props)} className="flex list-decimal flex-col gap-1 ps-5" />,
  li: ({ className, ...props }) => <li {...strip(props)} className={cx("ps-0.5 marker:text-text-tertiary", className?.includes("task-list-item") && "flex items-start gap-2 [&>input]:mt-1.5")} />,
  input: ({ type, checked }) => type === "checkbox" ? <input type="checkbox" checked={Boolean(checked)} disabled readOnly className="size-3.5 accent-current" /> : null,
  blockquote: (props) => <blockquote {...strip(props)} className="flex flex-col gap-2 border-s-2 border-separator-border ps-3 text-text-secondary" />,
  hr: () => <hr className="border-separator-border" />,
  code: ({ className, ...props }) => <code {...strip(props)} className={cx("rounded-md bg-background-secondary-default px-1 py-0.5 font-mono text-[0.9em]", className)} />,
  pre: (props) => <pre {...strip(props)} className="overflow-auto rounded-xl bg-background-secondary-default p-3 font-mono text-caption-1-regular" />,
  table: (props) => <div className="max-w-full overflow-x-auto rounded-xl border border-separator-border">
    <table {...strip(props)} className="w-full border-collapse text-body-2-regular" /></div>,
  thead: (props) => <thead {...strip(props)} className="bg-background-secondary-default" />,
  th: ({ style, ...props }) => <th {...strip(props)} style={style} className="border-b border-separator-border px-3 py-2 text-start text-body-2-medium text-text-primary" />,
  td: ({ style, ...props }) => <td {...strip(props)} style={style} className="border-b border-separator-border px-3 py-2 align-top text-text-secondary [tr:last-child>&]:border-b-0" />,
};
