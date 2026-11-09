import { StatusDot } from "@/components/base/badges/status-dot";

/**
 * One status line per settings category. Runtime categories say once, at the
 * top, that their service is not connected, instead of repeating it per field.
 * The scope text is "label · detail"; the label becomes the heading.
 */
export function SettingsServiceStatus({ runtime, scope }: { runtime: boolean; scope: string }) {
  const [label, ...rest] = scope.split(" · ");
  const detail = rest.join(" · ");
  return (
    <div role="note" className="flex items-start gap-3 rounded-2xl border border-separator-border bg-background-secondary-default p-3">
      <StatusDot color={runtime ? "yellow" : "green"} className="mt-1" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-body-medium text-text-primary">
          {label}
          <span className="ms-2 text-body-2-regular text-text-tertiary">{runtime ? "服务未接入" : "已在本机生效"}</span>
        </p>
        {detail && <p className="text-body-2-regular text-text-secondary">{detail}</p>}
        {runtime && <p className="text-body-2-regular text-text-tertiary">保存的是运行默认值，不会启动进程、访问文件或申请系统权限。</p>}
      </div>
    </div>
  );
}
