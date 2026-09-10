/**
 * 原型页面 href（`plan.html`、`settings.html#sec-usage`）到 React Router
 * 路径的映射。数据层与原型保持 `xxx.html` 写法，导航时统一经此转换。
 */
export function routeFor(href: string | null | undefined): string {
  if (!href) return "/";
  const match = href.match(/^([a-z0-9-]+)\.html(#.*)?$/i);
  if (!match) return href;
  const name = match[1].toLowerCase() === "index" ? "" : match[1];
  return "/" + name + (match[2] ?? "");
}
